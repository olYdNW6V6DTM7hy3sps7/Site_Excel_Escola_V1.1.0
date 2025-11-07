# Módulo 21: Suporte Multi-Linguagem (Python Idioms)
# Servidor Flask que expõe um endpoint para que o frontend possa 
# chamar a API OpenRouter de forma segura (sem expor a chave de API no cliente).

from flask import Flask, request, jsonify
import requests
import json
import os
from typing import Dict, Any

# Módulo 4: Simulação de Integrações - Chave de API vinculada
# ATENÇÃO: A chave é carregada da variável de ambiente 'OPENROUTER_API_KEY'
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
API_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL_NAME = "tngtech/deepseek-r1t2-chimera:free"

app = Flask(__name__)

# Configuração para permitir requisições CORS do frontend.
# Em um ambiente de produção real, use um domínio específico em vez de "*".
@app.after_request
def add_cors_headers(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'POST')
    return response

def _call_openrouter_api(ai_prompt: str, api_key: str) -> Dict[str, Any]:
    """Função interna para chamar a API OpenRouter."""
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {
                "role": "user",
                "content": ai_prompt
            }
        ]
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://127.0.0.1:5000", # Referência para o backend
        "X-Title": "Python Flask Backend", 
    }

    try:
        response = requests.post(
            url=API_URL,
            headers=headers,
            json=payload,
            timeout=30 
        )
        response.raise_for_status() 
        return response.json()

    except requests.exceptions.RequestException as err:
        app.logger.error(f"Erro ao chamar OpenRouter API: {err}")
        return {"error": "Falha na comunicação com a IA."}


# NOVO ENDPOINT: CHAT BOT DE ANÁLISE DE DADOS
@app.route('/api/chat-query', methods=['POST'])
def chat_query_endpoint():
    """
    Endpoint para consultas de chat baseadas nos dados da planilha.
    Recebe: { "user_query": "...", "excel_data_json": "..." }
    """
    # Verifica se a chave de API está configurada
    if not OPENROUTER_API_KEY:
        error_message = "Chave de API do OpenRouter não configurada. Defina a variável de ambiente OPENROUTER_API_KEY."
        app.logger.error(error_message)
        return jsonify({"error": error_message}), 500
        
    if not request.is_json:
        return jsonify({"error": "Missing JSON in request"}), 400
    
    data = request.get_json()
    user_query = data.get('user_query')
    excel_data_json = data.get('excel_data_json') # A planilha inteira em formato JSON string

    if not user_query:
        return jsonify({"error": "Missing 'user_query' in request body"}), 400
    
    # Validação: Se a string de dados estiver vazia, o bot não pode ajudar.
    if not excel_data_json or excel_data_json == "[]":
        return jsonify({"response_text": "Por favor, carregue um arquivo Excel primeiro para que eu possa analisar os dados."}), 200

    
    # ----------------------------------------------------------------------
    # DEEP SYSTEM PROMPT PARA O CHATBOT
    # ----------------------------------------------------------------------
    
    # Módulo 40: Deployment Wrapper - Prompt Estruturado para Chatbot Analista Escolar
    ai_prompt = f"""
# DEEP SYSTEM PROMPT: ASSISTENTE DE ANÁLISE DE DADOS ESCOLARES
Você é um Assistente de Dados de Alto Nível para uma Escola, especializado em extrair informações de planilhas.
Sua única fonte de conhecimento é a string JSON de Dados Excel que lhe foi fornecida.
Seu foco deve ser em Turmas, Nomes de Responsáveis, Nomes de Alunos e Números de Contato.

REGRAS RÍGIDAS:
1. Responda APENAS com base nos DADOS COMPLETOS.
2. NÃO INVENTE DADOS. Se a resposta não estiver na planilha, diga educadamente que a informação não foi encontrada.
3. Seja CONCISO e DIRETO. Use um tom profissional, cortês e prestativo.
4. O campo DADOS COMPLETOS é uma lista de objetos JSON. Analise-o para responder à pergunta.

# PERGUNTA DO USUÁRIO
{user_query}

# DADOS COMPLETOS DA PLANILHA EXCEL (Formato JSON)
{excel_data_json}

Responda à pergunta do usuário.
"""
        
    # Chama a função principal que interage com a API OpenRouter
    api_result = _call_openrouter_api(ai_prompt, OPENROUTER_API_KEY)
    
    if "error" in api_result:
        return jsonify(api_result), 500
        
    try:
        ai_response_text = api_result['choices'][0]['message']['content'].strip()
        # Retorna o texto bruto para o frontend
        return jsonify({"response_text": ai_response_text}), 200

    except (KeyError, IndexError) as e:
        app.logger.error(f"Erro de parsing ou estrutura de resposta da IA: {e}")
        return jsonify({"error": "Invalid response structure from AI model in chat endpoint"}), 500


@app.route('/api/detect-columns', methods=['POST'])
def detect_columns_endpoint():
    """
    Endpoint de API para receber dados do frontend e chamar a IA.
    Recebe: { "headers": [...], "sample_row": {...} }
    """
    # Verifica se a chave de API está configurada
    if not OPENROUTER_API_KEY:
        error_message = "Chave de API do OpenRouter não configurada. Defina a variável de ambiente OPENROUTER_API_KEY."
        app.logger.error(error_message)
        return jsonify({"error": error_message}), 500
        
    if not request.is_json:
        return jsonify({"error": "Missing JSON in request"}), 400
    
    data = request.get_json()
    headers = data.get('headers')
    sample_row = data.get('sample_row')

    if not headers or not sample_row:
        return jsonify({"error": "Missing 'headers' or 'sample_row' in request body"}), 400

    # ----------------------------------------------------------------------
    # MODIFICAÇÃO: Converte a linha de amostra em Matriz Unidimensional de Texto Puro
    # ----------------------------------------------------------------------
    
    # Mapeia todos os valores da linha de amostra para string e junta-os com vírgulas
    # Ex: {"Nome": "Alice", "Telefone": 5511} -> "Alice, 5511, ..."
    matriz_unidimensional_texto = ', '.join(map(str, sample_row.values()))

    # Módulo 40: Deployment Wrapper - Prompt Estruturado
    ai_prompt = f"""
# DEEP SYSTEM PROMPT: ANALISTA DE DADOS E MAPEAMENTO
Você é um Analista de Dados de Alto Nível com foco em extração de metadados de planilhas.
Sua única tarefa é mapear colunas de planilhas para campos semânticos.
Você DEVE retornar APENAS um objeto JSON válido, contendo as chaves 'name_key' e 'number_key'.
- 'name_key' deve ser o nome EXATO da coluna que representa o nome completo ou nome de contato.
- 'number_key' deve ser o nome EXATO da coluna que representa o telefone ou número de contato.
Não inclua texto explicativo, introdução, ou qualquer formatação Markdown extra (como ```json).
O seu trabalho se resume a retornar o JSON final.

# DADOS CONVERTIDOS DA TABELA EXCEL (MATRIZ UNIDIMENSIONAL DE TEXTO)
A tabela Excel foi convertida para o seguinte formato de matriz textual para análise:

COLUNAS (Títulos):
[{', '.join(headers)}]

LINHA DE AMOSTRA (Valores em ordem):
[{matriz_unidimensional_texto}]

Com base nas COLUNAS e na LINHA DE AMOSTRA fornecidas, identifique as chaves 'name_key' e 'number_key'.

Retorne APENAS o JSON conforme instruído no Deep System Prompt.
"""
        
    # Chama a função principal que interage com a API OpenRouter
    api_result = _call_openrouter_api(ai_prompt, OPENROUTER_API_KEY)
    
    if "error" in api_result:
        return jsonify(api_result), 500
        
    try:
        ai_response_text = api_result['choices'][0]['message']['content'].strip()
        # Limpa e tenta parsear a string JSON da IA
        clean_json_text = ai_response_text.replace('```json', '').replace('```', '').strip()
        final_result = json.loads(clean_json_text)
        
        # Módulo 26: Retorna a resposta JSON limpa para o frontend
        return jsonify(final_result), 200

    except (KeyError, IndexError, json.JSONDecodeError) as e:
        app.logger.error(f"Erro de parsing ou estrutura de resposta da IA: {e}")
        return jsonify({"error": "Invalid response structure from AI model"}), 500


if __name__ == '__main__':
    # Instrução: Para rodar o servidor, abra o terminal e execute: python openrouter_backend_api.py
    # Verificação local para desenvolvimento
    if not OPENROUTER_API_KEY:
        print("--- AVISO IMPORTANTE ---")
        print("Variável de ambiente 'OPENROUTER_API_KEY' não encontrada.")
        print("Para rodar localmente, defina-a no seu shell ou substitua a linha de carregamento pelo valor hardcoded (não recomendado para produção).")
        print("-------------------------")
        
    print("--- INICIANDO SERVIDOR FLASK ---")
    print("Execute este script e mantenha-o rodando.")
    print("O frontend (index.html) fará requisições para [http://127.0.0.1:5000/api/detect-columns](http://127.0.0.1:5000/api/detect-columns)")
    app.run(debug=True, port=5000)
