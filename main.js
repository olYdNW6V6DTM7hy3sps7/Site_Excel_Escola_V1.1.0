// WhatsApp Bulk Contact Manager & Messenger
// Main JavaScript Module
// ATUALIZADO: 8 de Novembro de 2025
// - NOVO: Lógica de "Busca Paginada Escalável"
// - A IA agora recebe lotes de 200 contatos, um de cada vez.
// - O JS gerencia o estado da busca (aiSearchState) e o loop de páginas.
// - A IA atua como "tradutora" de comandos complexos para tags de busca.
// - NOVO: (HOJE) Detecção Inteligente de Arquivos (PDF, Excel, CSV) e Conversão de PDF

// ** VARIÁVEL DE AMBIENTE DA API **
const API_BASE_URL = 'https://site-excel-escola-v1-1-0.onrender.com';

class WhatsAppBulkManager {
    constructor() {
        this.contacts = []; // A fonte da verdade (dados brutos)
        this.processedContacts = []; // Dados limpos e validados (para exibição)
        this.currentFile = null;
        this.columns = [];
        this.mode = 'vcf';
        this.chatHistory = []; 
        
        // Regex para deleção simples por ID (única lógica de deleção no JS)
        this.simpleDeleteRegex = /(remover|apagar|deletar|excluir)\s+(?:#|linha|id)?\s*(\d+)$/i;
        
        // Armazena a mensagem pendente enquanto aguarda a confirmação da IA
        this.pendingAiMessage = "";
        
        // NOVO: Gerenciador de Estado da Busca Paginada
        this.aiSearchState = {
            running: false,
            query: "",
            page: 0,
            chunkSize: 200,
            foundKeepId: null,      // Para "todos exceto X"
            foundDeleteIds: [], // Para "remover turma Y"
        };

        this.initializeElements();
        this.bindEvents();
        this.loadSavedState();
        this.initializeChat();
    }

    initializeElements() {
        // File upload elements
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.fileInfo = document.getElementById('fileInfo');
        this.fileName = document.getElementById('fileName');
        this.fileSize = document.getElementById('fileSize');
        this.removeFile = document.getElementById('removeFile');
        this.browseBtn = document.getElementById('browseBtn');
        // NOVO: Ícone do arquivo
        this.fileIcon = document.getElementById('fileIcon');

        // Column mapping elements
        this.mappingSection = document.getElementById('mappingSection');
        this.phoneColumn = document.getElementById('phoneColumn');
        this.aiStatus = document.getElementById('aiStatus');
        this.responsavelColumn = document.getElementById('responsavelColumn');
        this.alunoColumn = document.getElementById('alunoColumn'); 
        this.turmaColumn = document.getElementById('turmaColumn');


        // Preview elements
        this.previewSection = document.getElementById('previewSection');
        this.totalContacts = document.getElementById('totalContacts');
        this.contactTable = document.getElementById('contactTable');

        // Message composer elements
        this.messageSection = document.getElementById('messageSection');
        this.messageTemplate = document.getElementById('messageTemplate');
        this.messagePreview = document.getElementById('messagePreview');
        this.charCount = document.getElementById('charCount');

        // API config elements
        this.apiConfigSection = document.getElementById('apiConfigSection');
        this.accessToken = document.getElementById('accessToken');
        this.phoneNumberId = document.getElementById('phoneNumberId');
        this.templateName = document.getElementById('templateName');
        this.languageCode = document.getElementById('languageCode');

        // Action elements
        this.actionSection = document.getElementById('finalStepSection'); 
        this.generateVcfBtn = document.getElementById('generateVcfBtn');
        this.sendMessagesBtn = document.getElementById('sendMessagesBtn');
        
        this.vcfModeExplanation = document.getElementById('vcfModeExplanation');
        this.apiModeExplanation = document.getElementById('apiModeExplanation');


        // Mode toggle
        this.modeToggle = document.getElementById('modeToggle');

        // Modais
        this.progressModal = document.getElementById('progressModal');
        this.helpModal = document.getElementById('helpModal');
        
        // Modal de Confirmação (para remoção)
        this.confirmationModal = document.getElementById('confirmationModal');
        this.confirmTitle = document.getElementById('confirmTitle');
        this.confirmText = document.getElementById('confirmText'); // Agora é um DIV
        this.confirmActionBtn = document.getElementById('confirmActionBtn');
        this.confirmCancelBtn = document.getElementById('confirmCancelBtn');
        
        // NOVO: Modal de Confirmação de Envio para IA
        this.aiConfirmModal = document.getElementById('aiConfirmModal');
        this.aiConfirmText = document.getElementById('aiConfirmText');
        this.aiConfirmSendBtn = document.getElementById('aiConfirmSendBtn');
        this.aiConfirmCancelBtn = document.getElementById('aiConfirmCancelBtn');


        // Chatbot elements
        this.chatToggleBtn = document.getElementById('chatToggleBtn');
        this.chatContainer = document.getElementById('chatContainer');
        this.chatCloseBtn = document.getElementById('chatCloseBtn');
        this.chatMessages = document.getElementById('chatMessages');
        this.chatForm = document.getElementById('chatForm');
        this.chatInput = document.getElementById('chatInput');
        this.chatSendBtn = document.getElementById('chatSendBtn');
        this.chatStatus = document.getElementById('chatStatus');
        
        // Armazena a ação de confirmação pendente
        this.pendingConfirmAction = null;
    }

    bindEvents() {
        // File upload events
        this.dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
        this.dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.dropZone.addEventListener('drop', this.handleDrop.bind(this));
        this.dropZone.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        this.removeFile.addEventListener('click', this.clearFile.bind(this));

        // Column mapping events
        this.alunoColumn.addEventListener('change', this.updatePreview.bind(this));
        this.phoneColumn.addEventListener('change', this.updatePreview.bind(this));
        this.responsavelColumn.addEventListener('change', this.updatePreview.bind(this));
        this.turmaColumn.addEventListener('change', this.updatePreview.bind(this));


        // Message composer events
        this.messageTemplate.addEventListener('input', this.updateMessagePreview.bind(this));

        // Mode toggle
        this.modeToggle.addEventListener('change', this.toggleMode.bind(this));

        // Action buttons
        this.generateVcfBtn.addEventListener('click', this.generateVCF.bind(this));
        this.sendMessagesBtn.addEventListener('click', this.sendMessages.bind(this));

        // Modal events
        document.getElementById('helpBtn').addEventListener('click', () => this.showModal('helpModal'));
        document.getElementById('closeHelp').addEventListener('click', () => this.hideModal('helpModal'));
        document.getElementById('closeProgress').addEventListener('click', () => this.hideModal('progressModal'));

        // Eventos do Modal de Confirmação (Deleção)
        this.confirmCancelBtn.addEventListener('click', () => this.hideModal('confirmationModal'));
        this.confirmActionBtn.addEventListener('click', () => {
            if (this.pendingConfirmAction) {
                this.pendingConfirmAction();
            }
            this.hideModal('confirmationModal');
            this.pendingConfirmAction = null;
        });

        // NOVO: Eventos do Modal de Confirmação (Envio IA)
        this.aiConfirmCancelBtn.addEventListener('click', () => {
            this.hideModal('aiConfirmModal');
            this.addMessage("Busca escalável cancelada.", 'ai');
        });
        this.aiConfirmSendBtn.addEventListener('click', () => {
            this.hideModal('aiConfirmModal');
            if (this.pendingAiMessage) {
                // ATUALIZAÇÃO: Inicia a busca paginada em vez de chamar a API diretamente
                this.startPaginatedAiSearch(this.pendingAiMessage); 
                this.pendingAiMessage = ""; // Limpa a mensagem pendente
            }
        });


        // API config events
        this.accessToken.addEventListener('input', this.saveApiConfig.bind(this));
        this.phoneNumberId.addEventListener('input', this.saveApiConfig.bind(this));
        this.templateName.addEventListener('input', this.saveApiConfig.bind(this));
        this.languageCode.addEventListener('change', this.saveApiConfig.bind(this));

        // Chatbot events
        this.chatToggleBtn.addEventListener('click', this.toggleChat.bind(this));
        this.chatCloseBtn.addEventListener('click', this.toggleChat.bind(this));
        this.chatForm.addEventListener('submit', this.handleChatSubmit.bind(this));
        this.chatInput.addEventListener('input', () => {
            // Habilita/Desabilita o botão ao digitar
            this.chatSendBtn.disabled = this.chatInput.value.trim() === '';
        });
        // Garante que o botão está desabilitado no início
        this.chatSendBtn.disabled = true;
    }

    // --- Lógica do Chatbot (ATUALIZADA) ---
    
    initializeChat() {
        this.addMessage("Olá! Sou o Ajudante Geral a AI que pensa por você. Estou aqui para te ajudar a entender a estrutura do seu arquivo, como usar o site e até remover contatos da lista. O que você gostaria de saber?", 'ai', true);
    }
    
    toggleChat() {
        // ATUALIZAÇÃO: Usa classes de transição (opacity, scale, transform)
        // em vez de 'hidden' para um efeito "dinâmico".
        this.chatContainer.classList.toggle('opacity-0');
        this.chatContainer.classList.toggle('scale-95');
        this.chatContainer.classList.toggle('-translate-y-4');
        this.chatContainer.classList.toggle('pointer-events-none');
        
        if (!this.chatContainer.classList.contains('opacity-0')) {
            // Se o chat está abrindo (não contém mais opacity-0)
            this.scrollToBottom();
            this.chatInput.focus();
        }
    }
    
    async handleChatSubmit(e) {
        e.preventDefault();
        const userMessage = this.chatInput.value.trim();
        if (!userMessage) return;

        // Se uma busca já estiver rodando, não faça nada
        if (this.aiSearchState.running) {
            this.showError("Por favor, aguarde a busca escalável atual terminar.");
            return;
        }

        this.addMessage(userMessage, 'user');
        this.chatInput.value = '';
        this.chatSendBtn.disabled = true;

        // --- ATUALIZAÇÃO: Lógica de "Integração Mista" ---

        // 1. O JS tenta lidar com a lógica simples ("remover #15")
        const simpleHandled = this.checkSimpleDeletionJS(userMessage);
        if (simpleHandled) return; // O JS cuidou disso (rápido)
        
        // 2. Se não, é uma pergunta complexa ou normal.
        // Prepara a chamada para a IA, mas pede confirmação primeiro.
        this.prepareAndConfirmAiCall(userMessage);
    }
    
    // ATUALIZAÇÃO: Pede confirmação (LGPD) e avisa sobre a busca em lotes
    prepareAndConfirmAiCall(userMessage) {
        this.pendingAiMessage = userMessage; 
        
        // Calcula o tamanho do *primeiro* lote
        const firstChunk = this.processedContacts.slice(0, this.aiSearchState.chunkSize);
        if (firstChunk.length === 0 && this.contacts.length > 0) {
            this.addMessage("Por favor, mapeie as colunas de Aluno e Telefone primeiro para que eu possa analisar os dados.", 'ai');
            return;
        }
        
        const sampleJson = JSON.stringify(this.mapContactsForAI(firstChunk));
        
        // Cálculo aproximado de tokens (1 token ~ 4 caracteres)
        const approxTokens = Math.ceil(sampleJson.length / 4);
        
        const sampleCount = firstChunk.length;
        const totalCount = this.processedContacts.length;

        // Monta a mensagem de confirmação
        const messageHtml = `
            <p>Sua pergunta precisa ser analisada pela IA.</p>
            <p class="text-sm my-3">A IA irá analisar sua lista em lotes de ${this.aiSearchState.chunkSize} contatos para encontrar a informação (total de ${totalCount} contatos).</p>
            <ul class="list-disc list-inside text-sm mb-3 bg-gray-100 p-3 rounded-md">
                <li><strong>Primeiro Lote:</strong> ${sampleCount} contatos</li>
                <li><strong>Tamanho Estimado (Lote):</strong> ~${approxTokens} tokens</li>
            </ul>
            <p class="font-bold">Deseja iniciar a busca escalável?</p>
            <p class="text-xs text-gray-500 mt-2">(Seus dados de amostra são usados apenas para esta análise e não são armazenados.)</p>
        `;
        
        this.aiConfirmText.innerHTML = messageHtml;
        this.showModal('aiConfirmModal');
    }


    // ATUALIZAÇÃO: checkSimpleDeletionJS (lida apenas com IDs)
    checkSimpleDeletionJS(message) {
        const match = message.match(this.simpleDeleteRegex);

        if (match) {
            const targetIdStr = match[2]; // O ID capturado
            const targetId = parseInt(targetIdStr, 10);
            
            if (isNaN(targetId) || targetId <= 0) {
                 this.addMessage(`O ID "${this.escapeHtml(targetIdStr)}" não parece ser um número de linha válido.`, 'ai');
                 return true; // Intenção tratada (com falha)
            }
            
            // O ID (base 1) precisa ser convertido para índice (base 0)
            const originalIndex = targetId - 1; 
            
            // Verifica se o contato existe na lista original
            const contact = this.contacts[originalIndex];

            if (contact) {
                // Encontrou. Pega o nome do aluno da coluna mapeada
                const alunoKey = this.alunoColumn.value;
                const contactName = (alunoKey ? contact[alunoKey] : `Linha ${targetId}`) || `Linha ${targetId}`;

                const confirmationMessage = `<p>Você pediu para remover o ID #${targetId}: <strong>${this.escapeHtml(contactName)}</strong>. Confirma?</p>`;

                this.showConfirmationModal(
                    'Remover Contato',
                    confirmationMessage,
                    () => {
                        this.removeContactsBatch([originalIndex]);
                        this.addMessage(`Entendido. O contato "${this.escapeHtml(contactName)}" (ID ${targetId}) foi removido.`, 'ai');
                    }
                );
                return true; // Intenção tratada
            } else {
                // Não encontrou o ID
                this.addMessage(`Não consegui encontrar um contato com o ID #${targetId}. Verifique o número da linha na tabela.`, 'ai');
                return true; // Intenção tratada (com falha)
            }
        }
        return false; 
    }
    
    // NOVO: Funções de Busca Paginada
    
    startPaginatedAiSearch(userMessage) {
        // Reseta o estado da busca
        this.aiSearchState = {
            running: true,
            query: userMessage,
            page: 0,
            chunkSize: 200,
            foundKeepId: null,
            foundDeleteIds: [],
        };
        
        this.addMessage(`Iniciando busca escalável... Verificando contatos 1-${this.aiSearchState.chunkSize}.`, 'ai');
        this.runNextAiSearchPage();
    }
    
    async runNextAiSearchPage() {
        if (!this.aiSearchState.running) return; // A busca foi parada (ex: encontrou)

        const startIndex = this.aiSearchState.page * this.aiSearchState.chunkSize;
        const endIndex = startIndex + this.aiSearchState.chunkSize;
        
        const sampleChunk = this.processedContacts.slice(startIndex, endIndex);

        // --- CONDIÇÃO DE PARADA: Fim da Lista ---
        if (sampleChunk.length === 0) {
            this.aiSearchState.running = false;
            this.chatStatus.classList.add('hidden');

            if (this.aiSearchState.foundKeepId) {
                // Isso não deveria acontecer (pois pararia antes), mas é um bom failsafe.
                this.finalizeComplexDeletion(this.aiSearchState.foundKeepId);
            } else if (this.aiSearchState.foundDeleteIds.length > 0) {
                // A busca terminou e encontrou contatos para deletar em várias páginas
                this.finalizeSimpleDeletion(this.aiSearchState.foundDeleteIds);
            } else {
                // A busca terminou e não encontrou nada
                this.addMessage("Busca escalável concluída. Não encontrei nenhum contato correspondente em *toda* a lista.", 'ai');
            }
            return; // Fim do loop
        }
        
        // Mostra o status "digitando"
        this.chatStatus.classList.remove('hidden');

        // Mapeia os dados do lote para o formato que a IA espera
        const mappedChunk = this.mapContactsForAI(sampleChunk);
        
        // Envia o lote para a IA
        await this.callChatAPI(this.aiSearchState.query, mappedChunk, this.processedContacts.length);
    }
    
    // Finaliza "remover todos exceto X"
    finalizeComplexDeletion(keepId) {
        const indexesToRemove = [];
        let contactToKeep = null;
        
        // Percorre a lista *original*
        for (let i = 0; i < this.contacts.length; i++) {
            // O ID é (índice + 1)
            if (i === (keepId - 1)) {
                contactToKeep = this.contacts[i];
            } else {
                indexesToRemove.push(i);
            }
        }

        if (!contactToKeep) {
            this.showError("Erro: O contato a ser mantido não foi encontrado na lista original.");
            return;
        }

        const totalToRemove = indexesToRemove.length;
        const alunoKey = this.alunoColumn.value;
        const contactName = this.escapeHtml(contactToKeep[alunoKey] || `ID #${keepId}`);

        const confirmationMessage = `
            <p>Busca concluída! Encontrei o contato para manter:</p>
            <div class="text-sm bg-gray-100 p-3 rounded-md my-3">
                <strong>${contactName} (ID #${keepId})</strong>
            </div>
            <p class="font-bold text-red-600">Tem certeza que deseja remover TODOS OS OUTROS ${totalToRemove} contatos?</p>
        `;

        this.showConfirmationModal(
            'Remoção em Lote "Todos Exceto"',
            confirmationMessage,
            () => {
                this.removeContactsBatch(indexesToRemove);
                this.addMessage(`Ok! Removi ${totalToRemove} contatos e mantive "${contactName}".`, 'ai');
            }
        );
    }
    
    // Finaliza "remover turma Y"
    finalizeSimpleDeletion(deleteIds) {
        const originalIndexesToRemove = deleteIds.map(id => id - 1);
        const totalToRemove = originalIndexesToRemove.length;

        // Monta a lista de detalhes para confirmação
        let detailsHtml = '<ul class="list-disc list-inside text-left text-xs bg-gray-100 p-3 rounded-md max-h-40 overflow-y-auto mt-3">';
        let count = 0;
        
        const alunoKey = this.alunoColumn.value;
        const respKey = this.responsavelColumn.value;

        for (const index of originalIndexesToRemove) {
            const contact = this.contacts[index]; 
            if (contact) {
                if (count < 10) {
                    const aluno = this.escapeHtml(contact[alunoKey] || 'N/A');
                    const responsavel = this.escapeHtml(contact[respKey] || 'N/A');
                    detailsHtml += `<li><strong>${aluno}</strong> (Resp: ${responsavel})</li>`;
                }
                count++;
            }
        }
        
        if (count > 10) {
             detailsHtml += `<li>... e mais ${count - 10} contato(s).</li>`;
        }
        detailsHtml += '</ul>';

        const confirmationMessage = `<p>Busca escalável concluída! A IA encontrou um total de <strong>${totalToRemove} contato(s)</strong> para remoção. Confirma?</p> ${detailsHtml}`;
        
        this.showConfirmationModal(
            'Remoção em Lote via IA',
            confirmationMessage,
            () => {
                this.removeContactsBatch(originalIndexesToRemove);
                this.addMessage(`Ok! ${totalToRemove} contatos foram removidos.`, 'ai');
            }
        );
    }
    // --- Fim da Busca Paginada ---


    addMessage(text, role, isSilent = false) {
        let cleanedText = text;
        if (role === 'ai') {
            // Remove as tags de controle da IA antes de exibir
            cleanedText = text.replace(/\[SEARCH_PAGE_FAIL\]/g, '')
                              .replace(/\[SEARCH_FOUND_KEEP_ID:\s*\d+\]/g, '')
                              .replace(/\[SEARCH_FOUND_DELETE_IDS:[\d,\s]+\]/g, '')
                              .replace(/[*#]/g, '')
                              .trim();
        }
        
        // Não exiba mensagens de IA vazias (ex: se ela só retornou uma tag)
        if (role === 'ai' && !cleanedText && !isSilent) {
            return;
        }

        // Limita o histórico
        if (!isSilent && this.chatHistory.length >= 20) {
            this.chatHistory.shift(); 
        }
        
        const messageObject = { role: role, text: cleanedText }; 
        if (!isSilent) {
            this.chatHistory.push(messageObject);
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;

        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${role === 'user' ? 'user-message' : 'ai-message'}`;

        // Higieniza o TEXTO (previne XSS)
        const formattedText = this.escapeHtml(cleanedText).replace(/\n/g, '<br>');
        
        // Insere o texto higienizado
        bubble.innerHTML = formattedText;

        messageDiv.appendChild(bubble);
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    // ATUALIZAÇÃO: Mapeia um lote de contatos para a IA
    mapContactsForAI(contactChunk) {
        // Pega as colunas mapeadas para enviar os dados corretos
        const alunoKey = this.alunoColumn.value;
        const respKey = this.responsavelColumn.value;
        const turmaKey = this.turmaColumn.value;
        const phoneKey = this.phoneColumn.value;

        // USA O ID (índice + 1) DA LISTA PROCESSADA (que vem de this.contacts)
        return contactChunk.map(c => ({
            id: c.id, // O 'id' aqui é (originalIndex + 1)
            aluno: c.originalData[alunoKey] || '',
            responsavel: c.originalData[respKey] || '',
            turma: c.originalData[turmaKey] || '',
            telefone_original: c.originalData[phoneKey] || '',
            telefone_formatado: c.cleanedPhone,
            status: c.status
        }));
    }
    
    // ATUALIZAÇÃO: callChatAPI agora faz parte do loop paginado
    async callChatAPI(userMessage, sampleChunk, totalContacts) {
        
        // Monta o payload para este lote
        const sampleData = {
            status: "processing_complete",
            total_contacts: totalContacts,
            contact_sample: sampleChunk 
        };
        
        const historyPayload = this.chatHistory;
        
        const payload = {
            message: userMessage,
            history: historyPayload,
            contact_data_sample: JSON.stringify(sampleData) // Envia o lote atual
        };

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.status === 429) {
                this.addMessage('Desculpe, o limite de taxa para o chatbot foi excedido. Tente novamente em 1 hora.', 'ai');
                this.aiSearchState.running = false; // Para o loop
                return;
            }
            
            if (!response.ok) {
                 const errorData = await response.json().catch(() => ({ detail: 'Resposta de erro inesperada do servidor.' }));
                 this.addMessage(`Erro da API Chatbot: ${errorData.detail || 'Erro desconhecido.'}`, 'ai');
                 this.aiSearchState.running = false; // Para o loop
                 return;
            }

            const data = await response.json();
            const aiResponseText = data.response;
            
            this.chatStatus.classList.add('hidden'); // Esconde "digitando..."

            // --- Lógica de Roteamento da Resposta da IA ---
            
            const keepMatch = aiResponseText.match(/\[SEARCH_FOUND_KEEP_ID:\s*(\d+)\]/);
            const deleteMatch = aiResponseText.match(/\[SEARCH_FOUND_DELETE_IDS:\s*([\d,\s]+)\]/);

            if (keepMatch) {
                // FLUXO 1: Encontrou o "Todos Exceto"
                this.aiSearchState.running = false; // PARA O LOOP
                this.aiSearchState.foundKeepId = parseInt(keepMatch[1]);
                this.addMessage(aiResponseText, 'ai'); // Mostra a msg (ex: "Encontrei...")
                this.finalizeComplexDeletion(this.aiSearchState.foundKeepId);

            } else if (deleteMatch) {
                // FLUXO 2: Encontrou contatos para deletar NESTE LOTE
                const idsOnPage = deleteMatch[1].split(',').map(id => parseInt(id.trim()));
                this.aiSearchState.foundDeleteIds.push(...idsOnPage);
                
                this.addMessage(aiResponseText, 'ai'); // Mostra a msg (ex: "Encontrei 2...")
                
                // CONTINUA O LOOP
                this.aiSearchState.page++;
                this.runNextAiSearchPage();

            } else if (aiResponseText.includes("[SEARCH_PAGE_FAIL]")) {
                // FLUXO 3: Não encontrou nada neste lote
                this.addMessage(aiResponseText, 'ai'); // Mostra a msg (que deve estar vazia)
                
                // CONTINUA O LOOP
                this.aiSearchState.page++;
                const nextStartIndex = this.aiSearchState.page * this.aiSearchState.chunkSize + 1;
                const nextEndIndex = nextStartIndex + this.aiSearchState.chunkSize - 1;
                this.addMessage(`Verificando contatos ${nextStartIndex}-${nextEndIndex}...`, 'ai', true); // Mensagem silenciosa

                this.runNextAiSearchPage();

            } else {
                // FLUXO 4: Resposta de chat normal
                this.aiSearchState.running = false; // PARA O LOOP
                this.addMessage(aiResponseText, 'ai');
            }

        } catch (error) {
            console.error('Chat API Error:', error);
            this.addMessage('Desculpe, não foi possível conectar ao assistente de AI. Verifique se o backend do Render está ativo.', 'ai');
            this.aiSearchState.running = false; // Para o loop
        }
    }
    
    // --- Fim da Lógica do Chatbot ---


    // --- Lógica de Upload e Processamento (ATUALIZADA) ---
    
    handleDragOver(e) { e.preventDefault(); this.dropZone.classList.add('drag-over'); }
    handleDragLeave(e) { e.preventDefault(); this.dropZone.classList.remove('drag-over'); }
    handleDrop(e) {
        e.preventDefault();
        this.dropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) { this.processFile(files[0]); }
    }
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) { this.processFile(file); }
    }

    // NOVO: Roteador de Arquivos
    async processFile(file) {
        // 1. Limpa o estado da UI, exceto o arquivo
        this.contacts = [];
        this.processedContacts = [];
        this.mappingSection.classList.add('hidden');
        this.previewSection.classList.add('hidden');
        this.messageSection.classList.add('hidden');
        this.actionSection.classList.add('hidden');

        // 2. Define o arquivo atual e mostra informações
        this.currentFile = file;
        this.showFileInfo(file);
        
        // 3. Validação de tipo de arquivo
        const fileName = file.name.toLowerCase();
        const PDF_TO_EXCEL_API_URL = 'https://converter-pdf-para-excel.onrender.com/api/v1/convert/pdf-to-excel';

        if (file.size > 10 * 1024 * 1024) {
            this.showError('O tamanho do arquivo deve ser inferior a 10MB');
            this.clearFile(); // Limpa tudo
            return;
        }

        if (fileName.endsWith('.pdf')) {
            // --- Rota PDF ---
            await this.handlePdfUpload(file, PDF_TO_EXCEL_API_URL);
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
            // --- Rota Excel/CSV ---
            await this.handleExcelUpload(file);
        } else {
            // --- Rota Inválida ---
            this.showError('Arquivo não compatível. Por favor, use PDF, Excel (.xlsx, .xls) ou CSV.');
            this.clearFile(); // Limpa tudo
        }
    }

    // NOVO: Processador de PDF
    async handlePdfUpload(file, apiUrl) {
        // Esta função assume que `this.currentFile` e `showFileInfo`
        // já foram chamados por `processFile`.

        this.showProgress('Convertendo PDF', 'Enviando seu PDF para o servidor de conversão...');
        
        const formData = new FormData();
        formData.append('pdf_file', file);

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                // Trata erros da API
                let errorMsg = 'Erro de Conversão: Falha inesperada no servidor.';
                if (response.status === 400) {
                    errorMsg = 'Erro de Conversão: O arquivo enviado não parece ser um PDF válido.';
                } else if (response.status === 422) {
                    errorMsg = 'Erro de Conversão: O PDF é válido, mas nenhuma tabela foi encontrada.';
                } else if (response.status === 500) {
                    errorMsg = 'Erro de Conversão: Falha interna no servidor de PDF.';
                }
                
                this.hideProgress();
                this.showError(errorMsg);
                this.clearFile(); // Limpa o arquivo com falha
                return;
            }

            // Sucesso na conversão
            // Atualiza a mensagem de progresso
            document.getElementById('progressTitle').textContent = 'Processando Excel';
            document.getElementById('progressText').textContent = 'PDF convertido! Lendo dados do Excel resultante...';
            
            const excelBlob = await response.blob();
            
            // Cria um novo objeto File a partir do Blob
            const excelFile = new File([excelBlob], `${file.name.replace(/\.pdf$/i, '')}_converted.xlsx`, { 
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
            });
            
            // Atualiza a UI para mostrar o *novo* nome do arquivo
            this.currentFile = excelFile;
            this.showFileInfo(excelFile);

            // Entrega o novo arquivo Excel para a função de processamento
            // O `handleExcelUpload` cuidará de `hideProgress`
            await this.handleExcelUpload(excelFile);

        } catch (error) {
            console.error('Erro de Rede na Conversão PDF:', error);
            this.hideProgress();
            this.showError('Erro de Rede: Não foi possível conectar ao serviço de conversão de PDF.');
            this.clearFile();
        }
    }

    // NOVO: Processador de Excel/CSV (Refatorado do `processFile` original)
    async handleExcelUpload(file) {
        // Esta função assume que `this.currentFile` e `showFileInfo`
        // já foram chamados por `processFile`.
        
        try {
            // Mostra o progresso
            this.showProgress('Processando Arquivo', 'Lendo dados da planilha. Por favor, aguarde...');
            
            const contacts = await ExcelParser.parse(file);
            this.contacts = contacts; // Define a fonte da verdade
            this.hideProgress();
            
            this.showMappingSection();
            // Tenta a detecção e mapeamento automáticos
            await this.detectColumns(true);

        } catch (error) {
            this.hideProgress();
            this.showError('Erro ao analisar o arquivo Excel/CSV: ' + error.message);
            // Se o parse falhar, limpamos para evitar estado inconsistente
            this.clearFile(); 
        }
    }

    // NOVO: Helper para ícone do arquivo
    getFileIconClass(fileName) {
        const lowerName = (fileName || '').toLowerCase();
        if (lowerName.endsWith('.pdf')) {
            return 'fa-file-pdf text-red-600';
        }
        if (lowerName.endsWith('.csv')) {
            return 'fa-file-csv text-gray-700';
        }
        if (lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx')) {
            return 'fa-file-excel text-green-600';
        }
        return 'fa-file-lines text-gray-600'; // Padrão
    }

    showFileInfo(file) {
        // NOVO: Atualiza o ícone dinamicamente
        const iconClasses = this.getFileIconClass(file.name);
        this.fileIcon.className = `fas ${iconClasses} text-2xl mr-4`;

        this.fileName.textContent = file.name;
        this.fileSize.textContent = this.formatFileSize(file.size);
        this.fileInfo.classList.remove('hidden');
    }

    clearFile() {
        this.currentFile = null;
        this.contacts = [];
        this.processedContacts = [];
        this.fileInfo.classList.add('hidden');
        this.mappingSection.classList.add('hidden');
        this.previewSection.classList.add('hidden');
        this.messageSection.classList.add('hidden');
        this.apiConfigSection.classList.add('hidden');
        this.actionSection.classList.add('hidden');
        this.fileInput.value = '';
        
        // NOVO: Reseta o ícone
        this.fileIcon.className = 'fas fa-file-lines text-gray-600 text-2xl mr-4';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Column Mapping
    showMappingSection() {
        this.populateColumnSelectors();
        this.mappingSection.classList.remove('hidden');
        this.mappingSection.classList.add('fade-in');
    }

    populateColumnSelectors() {
        if (this.contacts.length === 0) return;

        const headers = Object.keys(this.contacts[0]);
        this.columns = headers;

        // Limpa e popula todos os seletores
        [this.alunoColumn, this.phoneColumn, this.responsavelColumn, this.turmaColumn].forEach(select => {
            select.innerHTML = '<option value="">Selecione a coluna...</option>';
            headers.forEach(header => {
                select.add(new Option(header, header));
            });
        });
    }

    async detectColumns(autoMode = false) {
        if (this.columns.length === 0) return;

        if (autoMode) {
             this.aiStatus.classList.remove('hidden');
             this.aiStatus.querySelector('span').textContent = 'AI detectando e mapeando colunas...';
        }
        
        try {
            const payload = {
                headers: this.columns,
                sample_data: this.contacts.slice(0, 5) // Envia uma amostra
            };
            
            const response = await fetch(`${API_BASE_URL}/api/detect-columns`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                 const errorData = await response.json().catch(() => ({ detail: 'Resposta de erro inesperada do servidor.' }));
                 throw new Error(errorData.detail || 'AI detection failed');
            }
            
            const result = await response.json();
            
            // Mapeamento usando as chaves de AI (name_key e number_key são genéricos)
            // Name Key é mapeado para Coluna do Aluno (Nome Principal)
            if (result.name_key && this.columns.includes(result.name_key)) {
                this.alunoColumn.value = result.name_key;
            }
            if (result.number_key && this.columns.includes(result.number_key)) {
                this.phoneColumn.value = result.number_key;
            }
            
            // Tentativa heurística para os outros campos (Responsável e Turma)
            this.responsavelColumn.value = this.findHeuristicColumn(this.columns, ['responsavel', 'resp', 'nome responsavel', 'nome_responsavel']);
            this.turmaColumn.value = this.findHeuristicColumn(this.columns, ['turma', 'class', 'sala', 'serie']);

            if (autoMode) {
                 this.aiStatus.querySelector('span').textContent = 'AI detectou e mapeou colunas automaticamente.';
            }
            this.updatePreview(); // Chama a atualização

        } catch (error) {
            console.error('AI detection failed:', error);
            this.showError('A detecção por AI falhou. Mapeie as colunas manualmente.');
            if (autoMode) {
                 this.aiStatus.querySelector('span').textContent = 'Falha na detecção AI. Por favor, mapeie manually.';
            }
            this.updatePreview(); // Chama a atualização mesmo em caso de falha
        }
    }
    
    // Helper para encontrar colunas por heurística
    findHeuristicColumn(headers, patterns) {
        for (const header of headers) {
            const lowerHeader = header.toLowerCase().replace(/[^a-z0-9]/g, ' ');
            if (patterns.some(p => lowerHeader.includes(p))) {
                return header;
            }
        }
        return '';
    }

    // --- Lógica de Prévia e Remoção (ATUALIZADA) ---

    updatePreview() {
        const alunoKey = this.alunoColumn.value; 
        const phoneKey = this.phoneColumn.value;
        const responsavelKey = this.responsavelColumn.value;
        const turmaKey = this.turmaColumn.value;

        // Se as colunas principais não estiverem definidas, não faz nada
        if (!alunoKey || !phoneKey) {
             // Limpa a prévia se as colunas forem des-selecionadas
             this.processedContacts = [];
             this.renderContactTable(); 
             this.previewSection.classList.add('hidden');
             this.messageSection.classList.add('hidden');
             this.actionSection.classList.add('hidden');
             return;
        }
        
        // Processa os contatos da fonte da verdade (`this.contacts`)
        this.processContacts(alunoKey, phoneKey, responsavelKey, turmaKey);
        
        // Mostra as seções
        this.showPreview();
        this.showMessageSection();
        this.showActionSection();
    }

    processContacts(alunoKey, phoneKey, responsavelKey, turmaKey) {
        const processedList = [];
        const invalidList = [];

        // Sempre processa a partir da lista original `this.contacts`
        this.contacts.forEach((contact, index) => {
            const aluno = contact[alunoKey] || 'Não Informado';
            const phone = contact[phoneKey] || '';
            
            // Limpa o número e captura DDD e status
            const cleaningResult = NumberCleaner.clean(phone); 
            const status = cleaningResult.status;

            const contactData = {
                id: index + 1, // ID é (índice original + 1)
                name: aluno.toString().trim(), // O nome principal para o template
                originalPhone: phone.toString().trim(),
                cleanedPhone: cleaningResult.cleanedPhone,
                ddd: cleaningResult.ddd, 
                status: status,
                
                // Dados adicionais para relatório de erro / tabela
                responsavel: contact[responsavelKey] || 'Não Informado',
                aluno: aluno,
                turma: contact[turmaKey] || 'Não Informado',
                
                originalData: contact
            };
            
            // Regra de invalidação
            if (status === 'invalid') {
                invalidList.push(contactData);
            } else {
                processedList.push(contactData);
            }
        });
        
        // Junta as listas, colocando inválidos no final
        this.processedContacts = processedList.concat(invalidList);
    }

    showPreview() {
        this.totalContacts.textContent = this.processedContacts.length;
        this.renderContactTable();
        this.previewSection.classList.remove('hidden');
        this.previewSection.classList.add('fade-in');
    }

    renderContactTable() {
        const tbody = this.contactTable;
        tbody.innerHTML = ''; // Limpa a tabela

        // Exibe mais contatos (primeiros 200)
        const displayContacts = this.processedContacts.slice(0, 200); 

        displayContacts.forEach(contact => {
            const row = document.createElement('tr');
            row.className = 'table-row';

            const statusIcon = this.getStatusIconHtml(contact.status);
            const statusClass = `status-${contact.status}`;

            // COMENTÁRIO DE SEGURANÇA (Anti-Hacking: XSS)
            // Todos os dados vindos da planilha (contact.aluno, .responsavel, etc.)
            // são passados pela função `this.escapeHtml` antes de serem
            // inseridos no `innerHTML`. Isso previne XSS.
            const phoneDisplay = contact.status === 'invalid' 
                                 ? this.escapeHtml(contact.originalPhone || 'Não Informado') 
                                 : this.escapeHtml(contact.cleanedPhone);

            row.innerHTML = `
                <td class="table-cell">${contact.id}</td>
                <td class="table-cell">${this.escapeHtml(contact.aluno)}</td>
                <td class="table-cell">${this.escapeHtml(contact.responsavel)}</td>
                <td class="table-cell">${this.escapeHtml(contact.turma)}</td>
                <td class="table-cell ${contact.status === 'invalid' ? 'text-red-500 font-medium' : ''}">
                    ${phoneDisplay}
                </td>
                <td class="table-cell">${contact.ddd || '-'}</td>
                <td class="table-cell ${statusClass}">
                    ${statusIcon}
                </td>
                <td class="table-cell">
                    <button onclick="app.downloadSingleVCF(${contact.id - 1})" 
                            class="text-blue-600 hover:text-blue-800 text-xs disabled:opacity-50"
                            title="Baixar VCF"
                            ${contact.status === 'invalid' ? 'disabled' : ''}>
                        <i class="fas fa-download"></i>
                    </button>
                    <!-- NOVO: Botão de Remover -->
                    <button onclick="app.confirmRemoveContact(${contact.id - 1})" 
                            class="text-red-600 hover:text-red-800 text-xs ml-2"
                            title="Remover Contato">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;

            tbody.appendChild(row);
        });
    }
    
    // NOVO: Funções de Remoção de Contato
    
    // 1. Mostra o modal de confirmação (para clique manual)
    confirmRemoveContact(originalIndex) {
        // Encontra o contato na lista original
        const contact = this.contacts[originalIndex];
        if (!contact) return;
        
        // Pega o nome do aluno da coluna mapeada
        const alunoKey = this.alunoColumn.value;
        const contactName = (alunoKey ? contact[alunoKey] : `Linha ${originalIndex + 1}`) || `Linha ${originalIndex + 1}`;

        // ATUALIZAÇÃO: Mensagem de confirmação
        const confirmationMessage = `<p>Tem certeza que deseja remover <strong>${this.escapeHtml(contactName)}</strong> da lista? Esta ação não pode ser desfeita.</p>`;

        this.showConfirmationModal(
            'Confirmar Remoção',
            confirmationMessage,
            () => {
                // ATUALIZAÇÃO: Chama a nova função de remoção em lote
                this.removeContactsBatch([originalIndex]);
            }
        );
    }
    
    // 2. ATUALIZAÇÃO: Renomeada de `removeContact` para `removeContactsBatch`
    // Remove um ou mais contatos da fonte da verdade (`this.contacts`) e atualiza a UI
    removeContactsBatch(originalIndexes) {
        if (!originalIndexes || originalIndexes.length === 0) {
            this.showError('Erro: Nenhum índice fornecido para remoção.');
            return;
        }

        // Filtra a lista original, mantendo apenas os que NÃO estão na lista de remoção
        // Ordena os índices em ordem decrescente para evitar problemas ao remover com splice
        const sortedIndexes = originalIndexes.sort((a, b) => b - a);

        let removedCount = 0;
        for (const index of sortedIndexes) {
            if (index > -1 && index < this.contacts.length) {
                this.contacts.splice(index, 1);
                removedCount++;
            }
        }
            
        // Dispara a atualização completa da UI
        // Isso reconstrói `processedContacts` e re-renderiza a tabela
        this.updatePreview();
        
        this.showSuccess(`${removedCount} contato(s) removido(s).`);
    }
    // --- Fim da Lógica de Remoção ---


    getStatusIconHtml(status) {
        switch (status) {
            case 'valid': return '<i class="fas fa-check-circle"></i> Válido';
            case 'invalid': return '<i class="fas fa-times-circle"></i> Inválido';
            default: return 'Inválido'; // Deve ser sempre valid ou invalid após a limpeza
        }
    }


    // Message Composer
    showMessageSection() {
        this.messageSection.classList.remove('hidden');
        this.messageSection.classList.add('fade-in');
        this.updateMessagePreview();
    }

    updateMessagePreview() {
        const template = this.messageTemplate.value;
        this.charCount.textContent = template.length;

        if (this.processedContacts.length > 0) {
            const firstContact = this.processedContacts[0];
            const preview = this.replacePlaceholders(template, firstContact);
            
            // COMENTÁRIO DE SEGURANÇA (Anti-Hacking: XSS)
            // Usamos `.textContent` para inserir a prévia.
            // Isso garante que, se o usuário digitar HTML/Script no template,
            // ele será renderizado como texto puro, e não executado.
            this.messagePreview.textContent = preview;
        } else {
            this.messagePreview.textContent = ""; // Limpa a prévia se não houver contatos
        }

        // Update character count color
        if (template.length > 4096) {
            this.charCount.className = 'text-xs text-red-500 font-medium';
        } else if (template.length > 3500) {
            this.charCount.className = 'text-xs text-yellow-500 font-medium';
        } else {
            this.charCount.className = 'text-xs text-gray-500';
        }
    }

    replacePlaceholders(template, contact) {
        let result = template;
        // Substitui {name} pelo nome do aluno
        result = result.replace(/{name}/g, contact.name || 'Nome_do_Aluno');
        
        // Substitui outros campos personalizados
        Object.keys(contact.originalData).forEach(key => {
            const placeholder = `{${key}}`;
            result = result.replace(new RegExp(placeholder, 'g'), contact.originalData[key] || '');
        });

        // Adiciona placeholders explícitos para os campos mapeados (caso o usuário use-os)
        result = result.replace(/{aluno}/g, contact.aluno || '');
        result = result.replace(/{responsavel}/g, contact.responsavel || '');
        result = result.replace(/{turma}/g, contact.turma || '');

        return result;
    }

    // Mode Toggle
    toggleMode() {
        this.mode = this.modeToggle.value;
        
        if (this.mode === 'api') {
            this.apiConfigSection.classList.remove('hidden');
            this.vcfModeExplanation.style.display = 'none';
            this.apiModeExplanation.style.display = 'block';
        } else { // modo 'vcf'
            this.apiConfigSection.classList.add('hidden');
            this.vcfModeExplanation.style.display = 'block';
            this.apiModeExplanation.style.display = 'none';
        }
    }

    // Action Section
    showActionSection() {
        this.actionSection.classList.remove('hidden');
        this.actionSection.classList.add('fade-in');
        this.toggleMode(); // Update button visibility
    }

    // --- Lógica de Geração e Envio ---

    // VCF Generation
    async generateVCF() {
        const validContacts = this.processedContacts.filter(c => c.status !== 'invalid');
        
        if (validContacts.length === 0) {
            this.showError('Nenhum contato válido para gerar arquivo VCF');
            return;
        }

        this.showProgress('Gerando Arquivo VCF', `Processando ${validContacts.length} contatos...`);

        try {
            const vcfContent = VCFGenerator.generate(validContacts);
            const blob = new Blob([vcfContent], { type: 'text/vcard' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `contacts_${new Date().getTime()}.vcf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.hideProgress();
            this.showSuccess(`Arquivo VCF gerado com ${validContacts.length} contatos`);

        } catch (error) {
            this.hideProgress();
            this.showError('Erro ao gerar arquivo VCF: ' + error.message);
        }
    }

    downloadSingleVCF(originalIndex) {
        // Encontra o contato correspondente na lista processada
        const contact = this.processedContacts.find(c => c.id === originalIndex + 1);
        if (!contact || contact.status === 'invalid') return;

        const vcfContent = VCFGenerator.generateSingle(contact);
        const blob = new Blob([vcfContent], { type: 'text/vcard' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        // COMENTÁRIO DE SEGURANÇA (Anti-Hacking: Sanitização)
        // Higieniza o nome do arquivo para remover caracteres inválidos
        const safeName = contact.name.replace(/[^a-zA-Z0-9]/g, '_');
        a.download = `${safeName}.vcf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // WhatsApp Cloud API
    async sendMessages() {
        const credentials = this.getApiCredentials();
        if (!this.validateCredentials(credentials)) {
            return;
        }

        const validContacts = this.processedContacts.filter(c => c.status !== 'invalid');
        if (validContacts.length === 0) {
            this.showError('Nenhum contato válido para enviar mensagens');
            return;
        }

        const messageTemplate = this.messageTemplate.value;
        if (!messageTemplate.trim() && !credentials.templateName) {
            this.showError('Por favor, insira um modelo de mensagem ou um nome de template aprovado.');
            return;
        }

        this.showProgress('Enviando Mensagens', `Iniciando envio para ${validContacts.length} contatos...`);

        try {
            const results = await WhatsAppAPI.sendBatch({
                contacts: validContacts,
                message: messageTemplate,
                credentials: credentials,
                onProgress: (progress) => {
                    this.updateProgress(progress.current, progress.total, progress.message);
                }
            });

            this.hideProgress();
            
            const successCount = results.success;
            const failedCount = results.failed;

            this.showSuccess(`Envio concluído. Sucesso: ${successCount}, Falha: ${failedCount}`);

        } catch (error) {
            this.hideProgress();
            this.showError('Erro ao enviar mensagens: ' + error.message);
        }
    }

    getApiCredentials() {
        return {
            accessToken: this.accessToken.value,
            phoneNumberId: this.phoneNumberId.value,
            templateName: this.templateName.value || '',
            languageCode: this.languageCode.value || 'pt_BR'
        };
    }

    validateCredentials(credentials) {
        if (!credentials.accessToken) {
            this.showError('Por favor, insira seu token de acesso da API do WhatsApp Business');
            return false;
        }
        if (!credentials.phoneNumberId) {
            this.showError('Por favor, insira o ID do seu número de telefone');
            return false;
        }
        return true;
    }

    // State Management
    saveApiConfig() {
        const config = this.getApiCredentials();
        // COMENTÁRIO DE SEGURANÇA (LGPD: Senhas e Autenticação)
        // O token é salvo no `sessionStorage`, que é mais seguro que
        // `localStorage` pois é limpo quando a aba é fechada.
        sessionStorage.setItem('whatsapp_api_config', JSON.stringify(config));
    }

    loadSavedState() {
        // Load API config from sessionStorage
        const savedConfig = sessionStorage.getItem('whatsapp_api_config');
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                this.accessToken.value = config.accessToken || '';
                this.phoneNumberId.value = config.phoneNumberId || '';
                this.templateName.value = config.templateName || '';
                this.languageCode.value = config.languageCode || 'pt_BR';
            } catch (error) {
                console.error('Erro ao carregar configuração salva:', error);
            }
        }

        // Load mode from localStorage
        const savedMode = localStorage.getItem('whatsapp_mode');
        if (savedMode) {
            this.modeToggle.value = savedMode;
            this.mode = savedMode;
        }
    }

    // --- Lógica de Modais e Notificações (ATUALIZADA) ---

    // NOVO: Modal de Confirmação Genérico
    showConfirmationModal(title, messageHtml, onConfirm) {
        // COMENTÁRIO DE SEGURANÇA (Anti-Hacking: XSS)
        // O `title` é inserido com `.textContent` (seguro).
        // A `messageHtml` é inserida com `.innerHTML`.
        // A responsabilidade de higienizar (escapar) os dados do usuário
        // (como nomes de alunos) agora está NAS FUNÇÕES QUE CHAMAM ESTE MODAL
        // (ex: `confirmRemoveContact` e `callChatAPI`).
        this.confirmTitle.textContent = title;
        this.confirmText.innerHTML = messageHtml;
        
        // Remove ouvintes antigos para evitar cliques duplos
        if (this.pendingConfirmAction) {
             this.confirmActionBtn.removeEventListener('click', this.pendingConfirmAction);
        }
        
        // Define a nova ação
        this.pendingConfirmAction = onConfirm;
        
        this.showModal('confirmationModal');
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    }

    // Progress Management
    showProgress(title, message) {
        document.getElementById('progressTitle').textContent = title;
        document.getElementById('progressText').textContent = message;
        // Usa `processedContacts` para a contagem total
        const total = this.processedContacts.filter(c => c.status !== 'invalid').length || (this.contacts || []).length || 0;
        document.getElementById('progressCount').textContent = `0/${total}`;
        document.getElementById('progressBar').style.width = `0%`;
        this.showModal('progressModal');
    }

    updateProgress(current, total, message) {
        const percentage = Math.round((current / total) * 100);
        document.getElementById('progressCount').textContent = `${current}/${total}`;
        document.getElementById('progressBar').style.width = `${percentage}%`;
        if (message) {
            document.getElementById('progressText').textContent = message;
        }
    }

    hideProgress() {
        this.hideModal('progressModal');
    }

    // Utility Methods
    showError(message) {
        this.showToast(message, 'error');
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-[1005] ${
            type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`; // Z-index alto
        // COMENTÁRIO DE SEGURANÇA (Anti-Hacking: XSS)
        // Mensagens de sistema (erros, sucesso) são inseridas com
        // `.textContent` para garantir que sejam seguras.
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 5000);
    }

    // NOVO: Helper de Higienização (Proteção XSS)
    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = text.toString(); // Converte para string
        return div.innerHTML;
    }
}

// --- Módulos Auxiliares ---

class ExcelParser {
    static async parse(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    // Força a leitura de datas como texto
                    const workbook = XLSX.read(data, { type: 'array', cellDates: false }); 
                    const sheetName = workbook.SheetNames[0];
                    // Mantém os tipos de dados originais (raw) para evitar corrompimento
                    const worksheet = workbook.Sheets[sheetName]; 
                    // Transforma para JSON, usando a primeira linha como cabeçalho
                    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (json.length < 2) {
                        reject(new Error('O arquivo deve conter pelo menos uma linha de cabeçalho e uma linha de dados'));
                        return;
                    }
                    
                    const headers = json[0].map(h => h ? h.toString().trim() : 'Coluna_Vazia');
                    const contacts = json.slice(1).map(row => {
                        const contact = {};
                        headers.forEach((header, index) => {
                            // COMENTÁRIO DE SEGURANÇA (LGPD: Integridade de Dados)
                            // Convertemos tudo para string no momento da leitura.
                            // Isso previne erros de tipo e garante que a higienização
                            // (escapeHtml) funcione corretamente.
                            contact[header] = row[index] !== undefined && row[index] !== null ? row[index].toString().trim() : '';
                        });
                        return contact;
                    });
                    
                    resolve(contacts);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
            reader.readAsArrayBuffer(file);
        });
    }
}

// Number Cleaner Module (Lógica de validação simplificada)
class NumberCleaner {
    
    // NOVO: Retorna um objeto com o número limpo, DDD e o status
    static clean(number) {
        if (!number) {
            return { cleanedPhone: '', ddd: '', status: 'invalid' };
        }
        
        // 1. Primeira limpeza: Remove tudo que não for dígito
        let digits = number.toString().replace(/\D/g, '');
        
        // 2. Retirar os 2 primeiros caracteres se eles forem == 55 (DDI Brasil)
        if (digits.startsWith('55')) {
            digits = digits.substring(2);
        }
        
        // Se o número começar com '0', remover (comum em discagens de longa distância)
        if (digits.startsWith('0')) {
            digits = digits.substring(1);
        }

        // Se o número for muito curto para ter DDD + 8 dígitos, é inválido
        if (digits.length < 10) { 
            return { cleanedPhone: number.toString(), ddd: '', status: 'invalid' };
        }
        
        // 3. Conferir e salvar o DDD (2 primeiros dígitos)
        const ddd = digits.substring(0, 2);
        let numberPart = digits.substring(2);
        
        // 4. Tratamento do dígito 9:
        if (numberPart.length === 9 && numberPart.startsWith('9')) {
            // Número móvel completo (9 + 8 dígitos). Normaliza para 8 dígitos para reconstrução
            numberPart = numberPart.substring(1); 
        } else if (numberPart.length === 8) {
            // Número fixo ou móvel legado (8 dígitos).
            // A API do WhatsApp (E.164) agora recomenda adicionar o 9
        } else {
            // Número tem 7, 10, ou mais de 11 dígitos, o que é inválido no padrão móvel
            return { cleanedPhone: number.toString(), ddd: ddd, status: 'invalid' };
        }
        
        // 5. Conferir se sobrou exatamente 8 dígitos (Validação final)
        if (numberPart.length !== 8) { 
            // Inválido: Se a lógica anterior foi ignorada, o número não é válido
            return { cleanedPhone: number.toString(), ddd: ddd, status: 'invalid' };
        }
        
        // Construção do número E.164 (sempre +55 + DDD + 9 + 8 dígitos)
        const finalNumber = `+55${ddd}9${numberPart}`;
        
        // Determinação do Status: Se sobrou 8 dígitos após toda a limpeza e normalização, é válido.
        const status = 'valid';
        
        return { cleanedPhone: finalNumber, ddd: ddd, status: status };
    }
}


// VCF Generator Module
class VCFGenerator {
    static generate(contacts) {
        // Filtra contatos com telefone limpo
        const vcards = contacts
            .filter(c => c.cleanedPhone && c.cleanedPhone.startsWith('+'))
            .map(contact => this.generateSingle(contact));
            
        // Adiciona cabeçalho e rodapé VCF. Note que 'BEGIN' e 'END' já estão em generateSingle.
        // Apenas junta as vcards.
        return vcards.join('\n');
    }

    static generateSingle(contact) {
        // COMENTÁRIO DE SEGURANÇA (Anti-Hacking: VCF Injection)
        // Embora `escapeHtml` não seja o padrão VCF, remover quebras de linha
        // e ponto-e-vírgula do nome previne a injeção de novos campos no VCF.
        const name = (contact.name || 'Unknown').replace(/[\n\r;]/g, ' ');
        const phone = contact.cleanedPhone || '';
        
        // O vCard requer N e FN
        return `BEGIN:VCARD
VERSION:3.0
FN:${name}
N:${name};;;;
TEL;TYPE=CELL:${phone}
END:VCARD`;
    }
}

// WhatsApp API Module
class WhatsAppAPI {
    // Implementação de alto nível para enviar lotes, usando o backend Render para processamento
    static async sendBatch({ contacts, message, credentials, onProgress }) {
        // Filtra apenas contatos válidos para o envio
        const validContacts = contacts.filter(c => c.status !== 'invalid');
        
        if (validContacts.length === 0) {
            throw new Error("Não há contatos válidos para envio após a validação.");
        }

        const payload = {
            contacts: validContacts,
            message: message,
            credentials: credentials
        };

        try {
            // 1. Inicia o Job de envio
            const response = await fetch(`${API_BASE_URL}/api/send-whatsapp-batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.status === 429) {
                throw new Error('Limite de taxa excedido. Tente novamente mais tarde.');
            }
            if (!response.ok) {
                 const errorData = await response.json().catch(() => ({ detail: 'Resposta de erro inesperada do servidor.' }));
                 throw new Error(`Falha ao iniciar o trabalho de envio: ${errorData.detail || 'Erro desconhecido.'}`);
            }
            
            const jobData = await response.json();
            const jobId = jobData.jobId;
            const totalContacts = jobData.totalContacts;
            
            // 2. Inicia o Polling para o status do job
            let status = 'processing';
            let totalSent = 0;
            let totalFailed = 0;
            let results = [];

            while (status === 'processing') {
                // Espera 3 segundos antes do próximo poll (reduz o load no Redis e no servidor)
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                try {
                    const statusResponse = await fetch(`${API_BASE_URL}/api/job-status/${jobId}`);
                    
                    // Trata erro 503 (Serviço indisponível, ex: Redis não configurado)
                    if (statusResponse.status === 503) {
                         throw new Error('Rastreamento de trabalho (Job tracking) indisponível. Verifique a configuração do Redis no backend.');
                    }

                    if (!statusResponse.ok) {
                         const errorDetail = await statusResponse.json().catch(() => ({ detail: 'Erro de rede desconhecido' }));
                         console.warn(`Falha ao obter status (tentando novamente): ${errorDetail.detail}`);
                         await new Promise(resolve => setTimeout(resolve, 2000)); // Espera extra
                         continue; // Tenta o loop novamente
                    }
                    
                    const statusData = await statusResponse.json();
                    status = statusData.status;
                    totalSent = statusData.completed || 0;
                    totalFailed = statusData.failed || 0;
                    results = statusData.results || [];
                    
                    if (onProgress) {
                        onProgress({
                            current: totalSent + totalFailed,
                            total: totalContacts,
                            message: `Processados: ${totalSent} com sucesso, ${totalFailed} com falha.`
                        });
                    }

                } catch (pollError) {
                    console.error("Erro no polling de status:", pollError);
                    // Continua tentando em caso de falha de rede no polling
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
            
            // 3. Retorna o resultado final
            return {
                total: totalContacts,
                success: totalSent,
                failed: totalFailed,
                results: results
            };

        } catch (error) {
            console.error('API Error during batch send:', error);
            throw error;
        }
    }
}

// Initialize Application
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new WhatsAppBulkManager();
});
