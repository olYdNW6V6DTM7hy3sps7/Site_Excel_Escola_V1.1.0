// WhatsApp Bulk Contact Manager & Messenger
// Main JavaScript Module
// ATUALIZADO: 8 de Novembro de 2025
// - Adicionada funcionalidade de remoção de contatos (Manual e via AI)
// - Adicionado modal de confirmação para ações destrutivas (sem usar alert/confirm)
// - Adicionada higienização de HTML em todas as saídas de dados do usuário (Proteção XSS)

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
        
        this.initializeElements();
        this.bindEvents();
        this.loadSavedState();
        this.initializeChat();
    }

    initializeElements() {
        // ... (elementos existentes) ...
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.fileInfo = document.getElementById('fileInfo');
        this.fileName = document.getElementById('fileName');
        this.fileSize = document.getElementById('fileSize');
        this.removeFile = document.getElementById('removeFile');
        this.browseBtn = document.getElementById('browseBtn');

        this.mappingSection = document.getElementById('mappingSection');
        this.phoneColumn = document.getElementById('phoneColumn');
        this.aiStatus = document.getElementById('aiStatus');
        this.responsavelColumn = document.getElementById('responsavelColumn');
        this.alunoColumn = document.getElementById('alunoColumn'); 
        this.turmaColumn = document.getElementById('turmaColumn');

        this.previewSection = document.getElementById('previewSection');
        this.totalContacts = document.getElementById('totalContacts');
        this.contactTable = document.getElementById('contactTable');

        this.messageSection = document.getElementById('messageSection');
        this.messageTemplate = document.getElementById('messageTemplate');
        this.messagePreview = document.getElementById('messagePreview');
        this.charCount = document.getElementById('charCount');

        this.apiConfigSection = document.getElementById('apiConfigSection');
        this.accessToken = document.getElementById('accessToken');
        this.phoneNumberId = document.getElementById('phoneNumberId');
        this.templateName = document.getElementById('templateName');
        this.languageCode = document.getElementById('languageCode');

        this.actionSection = document.getElementById('finalStepSection'); 
        this.generateVcfBtn = document.getElementById('generateVcfBtn');
        this.sendMessagesBtn = document.getElementById('sendMessagesBtn');
        
        this.vcfModeExplanation = document.getElementById('vcfModeExplanation');
        this.apiModeExplanation = document.getElementById('apiModeExplanation');

        this.modeToggle = document.getElementById('modeToggle');

        // Modais
        this.progressModal = document.getElementById('progressModal');
        this.helpModal = document.getElementById('helpModal');
        
        // NOVO: Modal de Confirmação (para remoção)
        this.confirmationModal = document.getElementById('confirmationModal');
        this.confirmTitle = document.getElementById('confirmTitle');
        this.confirmText = document.getElementById('confirmText');
        this.confirmActionBtn = document.getElementById('confirmActionBtn');
        this.confirmCancelBtn = document.getElementById('confirmCancelBtn');

        // Chatbot
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
        // ... (eventos de upload, mapping, etc.) ...
        this.dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
        this.dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.dropZone.addEventListener('drop', this.handleDrop.bind(this));
        this.dropZone.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        this.removeFile.addEventListener('click', this.clearFile.bind(this));

        this.alunoColumn.addEventListener('change', this.updatePreview.bind(this));
        this.phoneColumn.addEventListener('change', this.updatePreview.bind(this));
        this.responsavelColumn.addEventListener('change', this.updatePreview.bind(this));
        this.turmaColumn.addEventListener('change', this.updatePreview.bind(this));

        this.messageTemplate.addEventListener('input', this.updateMessagePreview.bind(this));
        this.modeToggle.addEventListener('change', this.toggleMode.bind(this));
        this.generateVcfBtn.addEventListener('click', this.generateVCF.bind(this));
        this.sendMessagesBtn.addEventListener('click', this.sendMessages.bind(this));

        // Eventos de Modais
        document.getElementById('helpBtn').addEventListener('click', () => this.showModal('helpModal'));
        document.getElementById('closeHelp').addEventListener('click', () => this.hideModal('helpModal'));
        document.getElementById('closeProgress').addEventListener('click', () => this.hideModal('progressModal'));

        // NOVO: Eventos do Modal de Confirmação
        this.confirmCancelBtn.addEventListener('click', () => this.hideModal('confirmationModal'));
        this.confirmActionBtn.addEventListener('click', () => {
            if (this.pendingConfirmAction) {
                this.pendingConfirmAction();
            }
            this.hideModal('confirmationModal');
            this.pendingConfirmAction = null;
        });


        // ... (eventos de config de API) ...
        this.accessToken.addEventListener('input', this.saveApiConfig.bind(this));
        this.phoneNumberId.addEventListener('input', this.saveApiConfig.bind(this));
        this.templateName.addEventListener('input', this.saveApiConfig.bind(this));
        this.languageCode.addEventListener('change', this.saveApiConfig.bind(this));

        // Eventos do Chatbot
        this.chatToggleBtn.addEventListener('click', this.toggleChat.bind(this));
        this.chatCloseBtn.addEventListener('click', this.toggleChat.bind(this));
        this.chatForm.addEventListener('submit', this.handleChatSubmit.bind(this));
        this.chatInput.addEventListener('input', () => {
            this.chatSendBtn.disabled = this.chatInput.value.trim() === '';
        });
        this.chatSendBtn.disabled = true;
    }

    // --- Lógica do Chatbot (ATUALIZADA) ---
    
    initializeChat() {
        this.addMessage("Olá! Sou o Ajudante Geral a AI que pensa por você. Estou aqui para te ajudar a entender a estrutura do seu arquivo, como usar o site e até remover contatos da lista. O que você gostaria de saber?", 'ai', true);
    }
    
    toggleChat() {
        this.chatContainer.classList.toggle('hidden');
        if (!this.chatContainer.classList.contains('hidden')) {
            this.scrollToBottom();
            this.chatInput.focus();
        }
    }
    
    async handleChatSubmit(e) {
        e.preventDefault();
        const userMessage = this.chatInput.value.trim();
        if (!userMessage) return;

        this.addMessage(userMessage, 'user');
        this.chatInput.value = '';
        this.chatSendBtn.disabled = true;

        // NOVO: Verificar intenção de remoção ANTES de chamar a API
        const deletionHandled = await this.checkDeletionIntent(userMessage);
        
        if (!deletionHandled) {
            // Se não for uma remoção, chama a IA
            this.callChatAPI(userMessage);
        }
    }

    // NOVO: Função para verificar intenção de remoção
    async checkDeletionIntent(message) {
        // Regex para capturar intenção (remover, apagar, etc.) + nome/ID
        const regex = /(remover|apagar|deletar|excluir)\s+(?:o\s+contato|contato|o\s+aluno|aluno)?\s*([A-Za-zÀ-ú\s\d'"#]+)/i;
        const match = message.match(regex);

        if (match) {
            const targetName = match[2].trim().replace(/['"]+/g, ''); // Limpa o nome/ID
            
            // Tenta encontrar o contato na lista processada
            // Busca pelo nome do aluno ou pelo ID (número da linha)
            const targetIndex = this.processedContacts.findIndex(contact => 
                (contact.aluno && contact.aluno.toLowerCase() === targetName.toLowerCase()) ||
                (contact.id.toString() === targetName)
            );

            if (targetIndex !== -1) {
                // Encontrou. Pega o ID original (que é o índice em `this.contacts`)
                const contactToRemove = this.processedContacts[targetIndex];
                const originalIndex = contactToRemove.id - 1; 

                // Mostra o modal de confirmação
                this.showConfirmationModal(
                    'Remover via IA',
                    `A IA entendeu que você quer remover o contato: <strong>${this.escapeHtml(contactToRemove.aluno)}</strong> (Linha ${contactToRemove.id}). Confirma?`,
                    () => {
                        this.removeContact(originalIndex);
                        this.addMessage(`Entendido. O contato "${this.escapeHtml(contactToRemove.aluno)}" foi removido da lista.`, 'ai');
                    }
                );
                return true; // Intenção tratada
            } else {
                // Não encontrou
                this.addMessage(`Não consegui encontrar um contato com o nome ou ID "${this.escapeHtml(targetName)}" na lista. Você pode tentar o nome exato ou o número da linha (Coluna #)?`, 'ai');
                return true; // Intenção tratada (com falha)
            }
        }
        return false; // Nenhuma intenção de remoção
    }


    addMessage(text, role, isSilent = false) {
        let cleanedText = text;
        if (role === 'ai') {
            cleanedText = text.replace(/[*#]/g, ''); 
        }

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

        // COMENTÁRIO DE SEGURANÇA (Anti-Hacking: XSS)
        // Usamos `escapeHtml` para higienizar CADA mensagem (do usuário e da IA)
        // antes de inseri-la no DOM com `innerHTML`. Isso previne XSS.
        const formattedText = this.escapeHtml(cleanedText).replace(/\n/g, '<br>'); 
        bubble.innerHTML = formattedText;

        messageDiv.appendChild(bubble);
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    getContactDataSample() {
        // ... (lógica existente para getContactDataSample) ...
        if (this.processedContacts.length === 0) {
            if (this.contacts.length === 0) return null;
            const sample = this.contacts.slice(0, 5);
            return JSON.stringify({
                status: "processing_not_started",
                sample_data: sample,
                total_contacts: this.contacts.length
            }, null, 2);
        }
        
        const validContacts = this.processedContacts.filter(c => c.status !== 'invalid');
        const invalidContacts = this.processedContacts.filter(c => c.status === 'invalid');

        const validSample = validContacts.slice(0, 5);
        const invalidSample = invalidContacts.slice(0, 10); 

        const summary = {
            status: "processing_complete",
            total_contacts: this.processedContacts.length,
            total_valid: validContacts.length,
            total_invalid: invalidContacts.length,
            invalid_contacts_sample: invalidSample.map(c => ({
                id: c.id,
                aluno: c.aluno,
                responsavel: c.responsavel,
                turma: c.turma,
                telefone_original: c.originalPhone,
                status: c.status
            })),
            valid_contacts_sample: validSample.map(c => ({
                id: c.id,
                aluno: c.aluno,
                telefone_formatado: c.cleanedPhone,
                status: c.status
            }))
        };
        
        return JSON.stringify(summary, null, 2);
    }
    
    async callChatAPI(userMessage, isInitial = false) {
        this.chatStatus.classList.remove('hidden');
        
        const dataSample = this.getContactDataSample();
        const historyPayload = this.chatHistory;
        
        const payload = {
            message: userMessage,
            history: historyPayload,
            contact_data_sample: dataSample
        };

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.status === 429) {
                this.addMessage('Desculpe, o limite de taxa para o chatbot foi excedido. Tente novamente em 1 hora.', 'ai');
                return;
            }
            
            if (!response.ok) {
                 const errorData = await response.json().catch(() => ({ detail: 'Resposta de erro inesperada do servidor.' }));
                 this.addMessage(`Erro da API Chatbot: ${errorData.detail || 'Erro desconhecido.'}`, 'ai');
                 this.chatHistory.pop();
                 return;
            }

            const data = await response.json();
            this.addMessage(data.response, 'ai');

        } catch (error) {
            console.error('Chat API Error:', error);
            this.addMessage('Desculpe, não foi possível conectar ao assistente de AI. Verifique se o backend do Render está ativo.', 'ai');
            this.chatHistory.pop();
        } finally {
            this.chatStatus.classList.add('hidden');
        }
    }
    
    // --- Fim da Lógica do Chatbot ---


    // --- Lógica de Upload e Processamento ---
    
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

    async processFile(file) {
        // ... (lógica existente de processFile) ...
        if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
            this.showError('Por favor, carregue um arquivo Excel ou CSV válido');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            this.showError('O tamanho do arquivo deve ser inferior a 10MB');
            return;
        }
        this.currentFile = file;
        this.showFileInfo(file);
        
        try {
            this.showProgress('Processando Arquivo', 'Lendo dados da planilha. Por favor, aguarde...');
            const contacts = await ExcelParser.parse(file);
            this.contacts = contacts; // Define a fonte da verdade
            this.hideProgress();
            
            this.showMappingSection();
            await this.detectColumns(true);

        } catch (error) {
            this.hideProgress();
            this.showError('Erro ao analisar o arquivo: ' + error.message);
        }
    }

    showFileInfo(file) {
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
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // ... (lógica de Mapeamento de Coluna, detectColumns, findHeuristicColumn) ...
    showMappingSection() {
        this.populateColumnSelectors();
        this.mappingSection.classList.remove('hidden');
        this.mappingSection.classList.add('fade-in');
    }

    populateColumnSelectors() {
        if (this.contacts.length === 0) return;
        const headers = Object.keys(this.contacts[0]);
        this.columns = headers;
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
                sample_data: this.contacts.slice(0, 5) 
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
            
            if (result.name_key && this.columns.includes(result.name_key)) {
                this.alunoColumn.value = result.name_key;
            }
            if (result.number_key && this.columns.includes(result.number_key)) {
                this.phoneColumn.value = result.number_key;
            }
            
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
            const cleaningResult = NumberCleaner.clean(phone); 
            
            const contactData = {
                id: index + 1, // ID é (índice original + 1)
                name: aluno.toString().trim(), 
                originalPhone: phone.toString().trim(),
                cleanedPhone: cleaningResult.cleanedPhone,
                ddd: cleaningResult.ddd, 
                status: cleaningResult.status,
                responsavel: contact[responsavelKey] || 'Não Informado',
                aluno: aluno,
                turma: contact[turmaKey] || 'Não Informado',
                originalData: contact
            };
            
            if (status === 'invalid') {
                invalidList.push(contactData);
            } else {
                processedList.push(contactData);
            }
        });
        
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
    
    // 1. Mostra o modal de confirmação
    confirmRemoveContact(originalIndex) {
        // Encontra o contato na lista original
        const contact = this.contacts[originalIndex];
        if (!contact) return;
        
        // Pega o nome do aluno da coluna mapeada
        const alunoKey = this.alunoColumn.value;
        const contactName = (alunoKey ? contact[alunoKey] : `Linha ${originalIndex + 1}`) || `Linha ${originalIndex + 1}`;

        this.showConfirmationModal(
            'Confirmar Remoção',
            `Tem certeza que deseja remover <strong>${this.escapeHtml(contactName)}</strong> da lista? Esta ação não pode ser desfeita.`,
            () => {
                this.removeContact(originalIndex);
            }
        );
    }
    
    // 2. Remove o contato da fonte da verdade (`this.contacts`) e atualiza a UI
    removeContact(originalIndex) {
        if (originalIndex > -1 && originalIndex < this.contacts.length) {
            // Remove da fonte da verdade
            const removed = this.contacts.splice(originalIndex, 1);
            
            // Dispara a atualização completa da UI
            // Isso reconstrói `processedContacts` e re-renderiza a tabela
            this.updatePreview();
            
            this.showSuccess('Contato removido com sucesso.');
        } else {
            this.showError('Erro: Não foi possível encontrar o índice do contato.');
        }
    }
    // --- Fim da Lógica de Remoção ---


    getStatusIconHtml(status) {
        switch (status) {
            case 'valid': return '<i class="fas fa-check-circle"></i> Válido';
            case 'invalid': return '<i class="fas fa-times-circle"></i> Inválido';
            default: return 'Inválido';
        }
    }

    // ... (funções de updateContactName/Phone removidas para simplificar,
    // a remoção é a principal forma de edição) ...
    
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
            this.messagePreview.textContent = "";
        }

        // ... (lógica de contagem de caracteres) ...
        if (template.length > 4096) {
            this.charCount.className = 'text-xs text-red-500 font-medium';
        } else if (template.length > 3500) {
            this.charCount.className = 'text-xs text-yellow-500 font-medium';
        } else {
            this.charCount.className = 'text-xs text-gray-500';
        }
    }

    replacePlaceholders(template, contact) {
        // ... (lógica existente de replacePlaceholders) ...
        let result = template;
        result = result.replace(/{name}/g, contact.name || 'Nome_do_Aluno');
        Object.keys(contact.originalData).forEach(key => {
            const placeholder = `{${key}}`;
            result = result.replace(new RegExp(placeholder, 'g'), contact.originalData[key] || '');
        });
        result = result.replace(/{aluno}/g, contact.aluno || '');
        result = result.replace(/{responsavel}/g, contact.responsavel || '');
        result = result.replace(/{turma}/g, contact.turma || '');
        return result;
    }

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

    showActionSection() {
        this.actionSection.classList.remove('hidden');
        this.actionSection.classList.add('fade-in');
        this.toggleMode(); 
    }

    // --- Lógica de Geração e Envio ---

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

    async sendMessages() {
        // ... (lógica existente de sendMessages) ...
        const credentials = this.getApiCredentials();
        if (!this.validateCredentials(credentials)) return;
        
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

    // ... (lógica de State Management) ...
    saveApiConfig() {
        const config = this.getApiCredentials();
        // COMENTÁRIO DE SEGURANÇA (LGPD: Senhas e Autenticação)
        // O token é salvo no `sessionStorage`, que é mais seguro que
        // `localStorage` pois é limpo quando a aba é fechada.
        sessionStorage.setItem('whatsapp_api_config', JSON.stringify(config));
    }
    loadSavedState() {
        const savedConfig = sessionStorage.getItem('whatsapp_api_config');
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                this.accessToken.value = config.accessToken || '';
                this.phoneNumberId.value = config.phoneNumberId || '';
                this.templateName.value = config.templateName || '';
                this.languageCode.value = config.languageCode || 'pt_BR';
            } catch (error) { console.error('Erro ao carregar configuração salva:', error); }
        }
        const savedMode = localStorage.getItem('whatsapp_mode');
        if (savedMode) {
            this.modeToggle.value = savedMode;
            this.mode = savedMode;
        }
    }
    
    // --- Lógica de Modais e Notificações (ATUALIZADA) ---

    // NOVO: Modal de Confirmação Genérico
    showConfirmationModal(title, message, onConfirm) {
        // COMENTÁRIO DE SEGURANÇA (Anti-Hacking: XSS)
        // O `title` é inserido com `.textContent` (seguro).
        // A `message` é inserida com `.innerHTML`, mas ela é 
        // construída internamente (ex: `confirmRemoveContact`)
        // e usa `escapeHtml` para higienizar qualquer dado do usuário.
        this.confirmTitle.textContent = title;
        this.confirmText.innerHTML = message;
        
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

    showProgress(title, message) {
        document.getElementById('progressTitle').textContent = title;
        document.getElementById('progressText').textContent = message;
        // Usa `processedContacts` para a contagem total
        const total = this.processedContacts.filter(c => c.status !== 'invalid').length;
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

    showError(message) { this.showToast(message, 'error'); }
    showSuccess(message) { this.showToast(message, 'success'); }

    showToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`;
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
                    const workbook = XLSX.read(data, { type: 'array', cellDates: false }); 
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName]; 
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

class NumberCleaner {
    static clean(number) {
        if (!number) {
            return { cleanedPhone: '', ddd: '', status: 'invalid' };
        }
        let digits = number.toString().replace(/\D/g, '');
        if (digits.startsWith('55')) {
            digits = digits.substring(2);
        }
        if (digits.startsWith('0')) {
            digits = digits.substring(1);
        }
        if (digits.length < 10) { 
            return { cleanedPhone: number.toString(), ddd: '', status: 'invalid' };
        }
        const ddd = digits.substring(0, 2);
        let numberPart = digits.substring(2);
        if (numberPart.length === 9 && numberPart.startsWith('9')) {
            numberPart = numberPart.substring(1); 
        } else if (numberPart.length === 8) {
            // Número válido
        } else {
            return { cleanedPhone: number.toString(), ddd: ddd, status: 'invalid' };
        }
        if (numberPart.length !== 8) { 
            return { cleanedPhone: number.toString(), ddd: ddd, status: 'invalid' };
        }
        const finalNumber = `+55${ddd}9${numberPart}`;
        const status = 'valid';
        return { cleanedPhone: finalNumber, ddd: ddd, status: status };
    }
}

class VCFGenerator {
    static generate(contacts) {
        const vcards = contacts
            .filter(c => c.cleanedPhone && c.cleanedPhone.startsWith('+'))
            .map(contact => this.generateSingle(contact));
        return vcards.join('\n');
    }

    static generateSingle(contact) {
        // COMENTÁRIO DE SEGURANÇA (Anti-Hacking: VCF Injection)
        // Embora `escapeHtml` não seja o padrão VCF, remover quebras de linha
        // e ponto-e-vírgula do nome previne a injeção de novos campos no VCF.
        const name = (contact.name || 'Unknown').replace(/[\n\r;]/g, ' ');
        const phone = contact.cleanedPhone || '';
        
        return `BEGIN:VCARD
VERSION:3.0
FN:${name}
N:${name};;;;
TEL;TYPE=CELL:${phone}
END:VCARD`;
    }
}

class WhatsAppAPI {
    static async sendBatch({ contacts, message, credentials, onProgress }) {
        const validContacts = contacts.filter(c => c.status !== 'invalid');
        if (validContacts.length === 0) {
            throw new Error("Não há contatos válidos para envio.");
        }
        const payload = {
            contacts: validContacts,
            message: message,
            credentials: credentials
        };
        try {
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
            
            let status = 'processing';
            let totalSent = 0;
            let totalFailed = 0;
            let results = [];

            while (status === 'processing') {
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                try {
                    const statusResponse = await fetch(`${API_BASE_URL}/api/job-status/${jobId}`);
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
