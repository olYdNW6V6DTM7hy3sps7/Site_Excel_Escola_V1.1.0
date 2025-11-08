"""
WhatsApp Bulk Contact Manager - Backend Proxy Server
FastAPI implementation for AI column detection, Chatbot, and WhatsApp Cloud API proxy
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
import os
from typing import Dict, List, Any, Optional
import redis
from datetime import datetime
import json
import asyncio
import re
from pydantic import BaseModel

# Configurações de Integração da AI
AI_MODEL = "tngtech/deepseek-r1t2-chimera:free"
# Constantes para OpenRouter (melhora a classificação e é boa prática)
SITE_URL = os.getenv("FRONTEND_URL", "http://localhost:8000") # Use a variável do Render
SITE_TITLE = "WhatsApp Bulk Manager"

class Config:
    # NOVO: Variável de ambiente para a API da AI (DeepSeek via OpenRouter)
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
    # REMOVIDO: GEMINI_API_KEY (substituído por OPENROUTER_API_KEY)
    REDIS_URL = os.getenv("RATE_LIMIT_REDIS_URL", "redis://localhost:6379")
    CORS_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "*").split(",")
    RATE_LIMIT_REQUESTS = 100
    RATE_LIMIT_WINDOW = 3600  # 1 hour

# Initialize FastAPI app
app = FastAPI(title="WhatsApp Bulk Manager API", version="1.1.1")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis client for rate limiting
redis_client = None
if Config.REDIS_URL:
    try:
        redis_client = redis.from_url(Config.REDIS_URL, decode_responses=True)
    except Exception as e:
        print(f"Redis connection failed: {e}")

# Request/Response Models
class ColumnDetectionRequest(BaseModel):
    headers: List[str]
    sample_data: List[Dict[str, Any]]

class WhatsAppSendRequest(BaseModel):
    contacts: List[Dict[str, Any]]
    message: str
    credentials: Dict[str, str]

class ChatMessage(BaseModel):
    role: str
    text: str
    
class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage]
    contact_data_sample: Optional[str] = None # JSON stringified contact data sample

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    services: Dict[str, str]

# Rate limiting decorator
async def check_rate_limit(client_ip: str) -> bool:
    """Check if client has exceeded rate limit"""
    if not redis_client:
        return True
    
    key = f"rate_limit:{client_ip}"
    try:
        # Permite 100 requisições por hora
        current = redis_client.incr(key)
        if current == 1:
            redis_client.expire(key, Config.RATE_LIMIT_WINDOW)
        
        return current <= Config.RATE_LIMIT_REQUESTS
    except Exception:
        # Em caso de erro do Redis, continua sem limitação (fail-open)
        return True

# Health check endpoint
@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    services_status = {
        "api": "healthy",
        "redis": "healthy" if redis_client else "disabled",
        "ai_api_key": "configured" if Config.OPENROUTER_API_KEY else "missing"
    }
    
    if redis_client:
        try:
            redis_client.ping()
        except Exception:
            services_status["redis"] = "unhealthy"
    
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow(),
        services=services_status
    )

# Deep Prompt/System Instruction para o Chatbot
SYSTEM_INSTRUCTION = """
Você é o "Ajudante Geral a AI que pensa por você", um assistente de IA focado em ajudar o usuário a gerenciar e processar listas de contatos para envio de mensagens em massa (bulk messaging) via WhatsApp.

SUA PERSONALIDADE:
1. Apresente-se sempre como: "Ajudante Geral a AI que pensa por você".
2. Seja prestativo, informativo, conciso e use um tom profissional e amigável.
3. Fale exclusivamente em Português do Brasil.
4. Ao se apresentar pela primeira vez, explique sua utilidade (analisar dados, guiar no uso do site).

SUAS TAREFAS E CONHECIMENTO SOBRE O SITE:
1. Entender o fluxo de trabalho do site:
    a. Upload de arquivo Excel/CSV.
    b. Mapeamento de colunas.
    c. Limpeza/validação de números (Status: "valid" ou "invalid").
    d. Geração VCF ou Envio via Cloud API.

2. **ANÁLISE DE DADOS (CRÍTICO):**
    Você receberá o contexto dos dados no formato JSON stringificado em `contact_data_sample`. Este JSON mudará dependendo do estado do aplicativo:

    A. Se o usuário AINDA NÃO PROCESSOU os contatos (status: "processing_not_started"):
        - O JSON conterá `sample_data` (dados brutos).
        - Use `sample_data` para ajudar o usuário a escolher as colunas corretas (ex: "Qual coluna é o telefone?").

    B. Se o usuário JÁ PROCESSOU os contatos (status: "processing_complete"):
        - O JSON conterá um resumo: `total_contacts`, `total_valid`, `total_invalid`.
        - Ele também conterá `invalid_contacts_sample` (uma lista de exemplos de contatos que falharam) e `valid_contacts_sample` (exemplos de contatos que funcionaram).

    **SUA REGRA MAIS IMPORTANTE:**
    - Se o usuário perguntar sobre contatos que "falharam", "inválidos", ou "deram erro":
        1. Olhe para `total_invalid`. Se for maior que 0, informe o número (ex: "Foram encontrados 4 contatos inválidos.").
        2. Use a lista `invalid_contacts_sample` para listar os nomes dos contatos que falharam (ex: "Aqui estão alguns deles: [Nome do Aluno], [Nome do Aluno]...").
        3. Use o campo `telefone_original` desses contatos para explicar POR QUE falharam (ex: "O número '123' é muito curto").
    - Se `total_invalid` for 0, diga "Nenhum contato falhou na validação."
    - NÃO diga "com base na amostra" se você tiver os dados de `processing_complete`. Use os totais.

3. Se o usuário perguntar algo não relacionado, redirecione educadamente para o tema de gerenciamento de contatos.
"""

@app.post("/api/chat")
async def handle_chat_query(request: ChatRequest, client_request: Request):
    """Endpoint para o Chatbot AI"""
    if not Config.OPENROUTER_API_KEY:
        raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY não configurada. Por favor, defina a variável de ambiente.")

    client_ip = client_request.client.host
    if not await check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Limite de taxa excedido. Tente novamente mais tarde."
        )

    # Constrói o histórico de mensagens para a API OpenRouter
    messages = []
    
    # 1. Adiciona a instrução do sistema
    messages.append({"role": "system", "content": SYSTEM_INSTRUCTION})

    # 2. Processa o histórico existente e a nova mensagem do usuário
    for message in request.history:
        # OpenRouter usa 'assistant' para a AI
        role = "user" if message.role == "user" else "assistant"
        messages.append({"role": role, "content": message.text})
    
    # Adiciona o contexto dos dados do Excel se fornecido na última mensagem do histórico
    last_user_prompt = messages[-1]["content"]
    if request.contact_data_sample:
        data_context = f"\n\n--- DADOS DE CONTEXTO DO EXCEL (JSON stringified) ---\n{request.contact_data_sample}\n--- FIM DOS DADOS DE CONTEXTO ---\n"
        last_user_prompt += data_context
    messages[-1]["content"] = last_user_prompt

    # Prepara o payload para a API OpenRouter (DeepSeek R1T2)
    payload = {
        "model": AI_MODEL,
        "messages": messages,
        "temperature": 0.5,
        "max_tokens": 512
    }
    
    headers = {
        "Authorization": f"Bearer {Config.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": SITE_URL,
        "X-Title": SITE_TITLE,
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Implementação de backoff exponencial simples
            max_retries = 3
            delay = 1
            response = None
            
            for attempt in range(max_retries):
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=payload
                )
                
                if response.status_code != 429 and response.status_code < 500:
                    break
                
                if attempt < max_retries - 1:
                    await asyncio.sleep(delay)
                    delay *= 2
                else:
                    raise HTTPException(status_code=response.status_code, detail="Erro de serviço da AI ou limite de taxa excedido.")

            
            if response.status_code != 200:
                print(f"Erro da API OpenRouter: {response.text}")
                raise HTTPException(status_code=500, detail=f"Erro ao comunicar com a AI. Código: {response.status_code}")

            result = response.json()
            # Tenta extrair o texto da resposta
            ai_text = result.get("choices", [{}])[0].get("message", {}).get("content")
            
            if not ai_text:
                print(f"Resposta da AI sem texto: {result}")
                raise HTTPException(status_code=500, detail="A AI retornou uma resposta inesperada.")
            
            return {"response": ai_text}

    except HTTPException:
        raise # Rethrow HTTPException
    except Exception as e:
        print(f"Erro geral no Chatbot: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno do servidor: {str(e)}")

# AI Column Detection Endpoint (Modificado para usar DeepSeek R1T2 ou Heuristic)
@app.post("/api/detect-columns")
async def detect_columns(request: ColumnDetectionRequest, client_request: Request):
    """Detect name and phone columns using AI or heuristic fallback"""
    client_ip = client_request.client.host
    
    # Rate limiting
    if not await check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Limite de taxa excedido. Tente novamente mais tarde."
        )
    
    # Tenta usar a AI para detecção de colunas se a chave estiver configurada
    if Config.OPENROUTER_API_KEY:
        try:
            # Prepare data for AI analysis
            headers_text = ", ".join(request.headers)
            sample_rows = []
            for row in request.sample_data[:5]:  # Send first 5 rows
                row_text = ", ".join([f"'{k}': '{v}'" for k, v in row.items()])
                sample_rows.append(row_text)
            
            sample_text = "; ".join(sample_rows)
            
            # *** CORREÇÃO APLICADA AQUI (da última conversa) ***
            # System Prompt para detecção de colunas (ATUALIZADO)
            system_prompt = """Você é um analista de dados. Sua tarefa é identificar a coluna de 'nome principal' e 'número de telefone'.

            Retorne SOMENTE um objeto JSON válido com este formato exato:
            {"name_key": "nome_da_coluna", "number_key": "nome_da_coluna"}

            Regras:
            - **name_key (Nome Principal)**: Esta é a coluna mais importante. Priorize colunas que pareçam ser o nome de um 'aluno' (ex: "Nome do Aluno", "Aluno", "Nome Aluno"). Se não encontrar uma coluna de aluno, procure por um nome genérico (ex: "Nome", "Name", "Nome Completo").
            - **number_key (Telefone)**: Coluna que contém números de telefone.
            - Use os nomes exatos das colunas fornecidos nos cabeçalhos.
            - Se não tiver certeza, retorne uma string vazia ("")."""
            
            user_prompt = f"""{system_prompt}
            Cabeçalhos: {headers_text}
            Amostra de dados (5 primeiras linhas): {sample_text}
            
            Identifique as colunas de Nome e Número de Telefone."""
            
            messages = [
                {"role": "user", "content": user_prompt}
            ]

            headers = {
                "Authorization": f"Bearer {Config.OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": SITE_URL,
                "X-Title": SITE_TITLE,
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json={
                        "model": AI_MODEL,
                        "messages": messages,
                        "temperature": 0.1,
                        "max_tokens": 150
                    }
                )
                
                if response.status_code != 200:
                    # Fallback para o heuristic se a chamada da AI falhar
                    return await heuristic_column_detection(request.headers)
                
                result = response.json()
                content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
                
                # Tenta extrair e carregar o JSON (OpenRouter nem sempre garante JSON puro)
                try:
                    json_match = re.search(r'\{[^}]+\}', content)
                    if json_match:
                        ai_result = json.loads(json_match.group())
                    else:
                        raise json.JSONDecodeError("JSON não encontrado", content, 0)
                    
                    # Validação final para garantir que as chaves retornadas são válidas
                    name_key = ai_result.get("name_key", "")
                    number_key = ai_result.get("number_key", "")
                    
                    if name_key not in request.headers: name_key = ""
                    if number_key not in request.headers: number_key = ""
                    
                    return {"name_key": name_key, "number_key": number_key}
                        
                except (json.JSONDecodeError, KeyError) as e:
                    print(f"AI JSON parsing failed, using heuristic: {e}")
                    return await heuristic_column_detection(request.headers)
                    
        except Exception as e:
            print(f"AI column detection (OpenRouter) error: {e}")
            return await heuristic_column_detection(request.headers)
            
    # Fallback para o heuristic se OPENROUTER_API_KEY não estiver configurada
    return await heuristic_column_detection(request.headers)


async def heuristic_column_detection(headers: List[str]) -> Dict[str, str]:
    """Fallback heuristic column detection"""
    # *** ATUALIZADO: Prioriza 'aluno' na heurística também ***
    name_patterns = ['aluno', 'nome aluno', 'nome_aluno', 'name', 'nome', 'full_name', 'full name', 'customer_name', 'customer name', 'contact_name', 'contact name']
    phone_patterns = ['phone', 'telefone', 'mobile', 'cell', 'whatsapp', 'phone_number', 'phone number', 'celular']
    
    name_key = ""
    number_key = ""
    
    # Busca por nome (com prioridade)
    for pattern in name_patterns:
        for header in headers:
            header_lower_simple = header.lower().replace("_", " ")
            if pattern == header_lower_simple:
                name_key = header
                break
        if name_key:
            break
            
    # Busca por telefone (com prioridade)
    for pattern in phone_patterns:
        for header in headers:
            header_lower_simple = header.lower().replace("_", " ")
            if pattern == header_lower_simple:
                number_key = header
                break
        if number_key:
            break

    # Fallback (se a busca exata falhou, tenta 'in')
    if not name_key:
        for header in headers:
            header_lower = header.lower()
            for pattern in name_patterns:
                if pattern in header_lower:
                    name_key = header
                    break
            if name_key:
                break
                
    if not number_key:
        for header in headers:
            header_lower = header.lower()
            for pattern in phone_patterns:
                if pattern in header_lower:
                    number_key = header
                    break
            if number_key:
                break
    
    return {"name_key": name_key, "number_key": number_key}

# WhatsApp Batch Send Endpoint
@app.post("/api/send-whatsapp-batch")
async def send_whatsapp_batch(request: WhatsAppSendRequest, client_request: Request):
    """Send WhatsApp messages in batch via Cloud API"""
    client_ip = client_request.client.host
    
    # Rate limiting
    if not await check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Limite de taxa excedido. Tente novamente mais tarde."
        )
    
    # Validate request
    if not request.contacts:
        raise HTTPException(status_code=400, detail="Nenhum contato fornecido")
    
    # Validate credentials
    credentials = request.credentials
    required_creds = ["accessToken", "phoneNumberId"]
    for cred in required_creds:
        if not credentials.get(cred):
            raise HTTPException(status_code=400, detail=f"Credencial faltando: {cred}")
    
    # Process contacts in background
    job_id = f"whatsapp_job_{datetime.utcnow().timestamp()}"
    
    # Start background task
    asyncio.create_task(process_whatsapp_batch(
        job_id, request.contacts, request.message, credentials
    ))
    
    return {
        "jobId": job_id,
        "status": "processing",
        "totalContacts": len(request.contacts),
        "estimatedTime": len(request.contacts) * 0.1  # 100ms per message estimate
    }

async def process_whatsapp_batch(job_id: str, contacts: List[Dict], message: str, credentials: Dict):
    """Process WhatsApp messages in background"""
    
    # Store job status in Redis
    if redis_client:
        redis_client.setex(f"job:{job_id}", 3600, json.dumps({
            "status": "processing",
            "total": len(contacts),
            "completed": 0,
            "failed": 0,
            "results": []
        }))
    
    results = []
    batch_size = 10
    delay = 1000  # 1 second between batches
    
    for i in range(0, len(contacts), batch_size):
        batch = contacts[i:i + batch_size]
        batch_results = await send_whatsapp_batch_api(batch, message, credentials)
        results.extend(batch_results)
        
        # Update progress
        if redis_client:
            completed = len([r for r in results if r.get("success")])
            failed = len([r for r in results if not r.get("success")])
            
            redis_client.setex(f"job:{job_id}", 3600, json.dumps({
                "status": "processing",
                "total": len(contacts),
                "completed": completed,
                "failed": failed,
                "results": results
            }))
        
        # Wait before next batch
        if i + batch_size < len(contacts):
            await asyncio.sleep(delay / 1000)
    
    # Mark job as completed
    if redis_client:
        completed = len([r for r in results if r.get("success")])
        failed = len([r for r in results if not r.get("success")])
        
        redis_client.setex(f"job:{job_id}", 3600, json.dumps({
            "status": "completed",
            "total": len(contacts),
            "completed": completed,
            "failed": failed,
            "results": results
        }))

async def send_whatsapp_batch_api(contacts: List[Dict], message: str, credentials: Dict) -> List[Dict]:
    """Send WhatsApp messages via Cloud API"""
    
    results = []
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for contact in contacts:
            try:
                # Prepare phone number (remove leading '+')
                phone = contact.get("cleanedPhone", contact.get("phone", "")).replace("+", "")
                
                # Determine API endpoint
                phone_number_id = credentials["phoneNumberId"]
                access_token = credentials["accessToken"]
                template_name = credentials.get("templateName", "")
                language_code = credentials.get("languageCode", "pt_BR")
                
                # Substitui placeholders na mensagem de texto
                personalized_message = message.replace("{name}", contact.get("name", ""))
                
                # Se houver template name, tenta enviar como template. Senão, envia como mensagem de texto.
                if template_name and template_name.strip() and template_name != 'hello_world':
                    # Tenta enviar como Template message
                    payload = {
                        "messaging_product": "whatsapp",
                        "to": phone,
                        "type": "template",
                        "template": {
                            "name": template_name,
                            "language": {
                                "code": language_code
                            },
                            # Aqui o payload do template pode precisar ser mais complexo dependendo do template.
                            # Para simplificar, estamos assumindo que o template só precisa do campo {name} no body
                            "components": [
                                {
                                    "type": "body",
                                    "parameters": [
                                        {"type": "text", "text": contact.get("name", "")}
                                    ]
                                }
                            ]
                        }
                    }
                else:
                    # Custom text message (padrão)
                    payload = {
                        "messaging_product": "whatsapp",
                        "to": phone,
                        "type": "text",
                        "text": {
                            "body": personalized_message
                        }
                    }
                
                # Send message
                response = await client.post(
                    f"https://graph.facebook.com/v18.0/{phone_number_id}/messages",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json"
                    },
                    json=payload
                )
                
                if response.status_code == 200:
                    result_data = response.json()
                    results.append({
                        "contact_id": contact.get("id"),
                        "phone": contact.get("cleanedPhone"),
                        "success": True,
                        "messageId": result_data.get("messages", [{}])[0].get("id"),
                        "timestamp": datetime.utcnow().isoformat()
                    })
                else:
                    results.append({
                        "contact_id": contact.get("id"),
                        "phone": contact.get("cleanedPhone"),
                        "success": False,
                        "error": response.text,
                        "timestamp": datetime.utcnow().isoformat()
                    })
                
            except Exception as e:
                results.append({
                    "contact_id": contact.get("id"),
                    "phone": contact.get("cleanedPhone"),
                    "success": False,
                    "error": str(e),
                    "timestamp": datetime.utcnow().isoformat()
                })
    
    return results

# Job status endpoint
@app.get("/api/job-status/{job_id}")
async def get_job_status(job_id: str):
    """Get status of a WhatsApp sending job"""
    
    if not redis_client:
        # Se o Redis não estiver configurado, um trabalho de background deve ser tratado de forma diferente
        # Neste cenário de trabalho de longa duração, sem Redis, o job não é rastreável.
        # Vamos lançar um erro informativo.
        raise HTTPException(status_code=503, detail="Rastreamento de trabalho (Job tracking) não disponível sem Redis configurado.")
    
    try:
        job_data = redis_client.get(f"job:{job_id}")
        if not job_data:
            raise HTTPException(status_code=404, detail="Trabalho (Job) não encontrado")
        
        return json.loads(job_data)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail="Falha ao recuperar o status do trabalho")

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "status_code": exc.status_code}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
