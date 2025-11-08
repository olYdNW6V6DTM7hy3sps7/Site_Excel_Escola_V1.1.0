// WhatsApp Bulk Contact Manager & Messenger
// Main JavaScript Module

// ** VARIÁVEL DE AMBIENTE DA API (ATUALIZE ESTE VALOR) **
// Configure com o URL principal do seu serviço Render (ex: https://seu-servico.onrender.com)
const API_BASE_URL = 'https://site-excel-escola-v1-1-0.onrender.com';

class WhatsAppBulkManager {
    constructor() {
        this.contacts = [];
        this.processedContacts = [];
        this.currentFile = null;
        this.columns = [];
        this.mode = 'vcf';
        this.chatHistory = []; // Novo: Histórico do Chatbot
        
        this.initializeElements();
        this.bindEvents();
        this.loadSavedState();
        this.initializeChat(); // Novo: Inicializa o Chatbot
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

        // Column mapping elements
        this.mappingSection = document.getElementById('mappingSection');
        // REMOVIDO: this.nameColumn (Substituído por alunoColumn)
        this.phoneColumn = document.getElementById('phoneColumn');
        // REMOVIDO: this.detectColumnsBtn (A detecção é automática)
        this.aiStatus = document.getElementById('aiStatus');
        
        // NOVO: Campos para identificação de erros (e nome principal)
        this.responsavelColumn = document.getElementById('responsavelColumn');
        this.alunoColumn = document.getElementById('alunoColumn'); // Usado como "name" principal
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
        this.actionSection = document.getElementById('actionSection');
        this.generateVcfBtn = document.getElementById('generateVcfBtn');
        this.sendMessagesBtn = document.getElementById('sendMessagesBtn');

        // Mode toggle
        this.modeToggle = document.getElementById('modeToggle');

        // Modal elements
        this.progressModal = document.getElementById('progressModal');
        this.helpModal = document.getElementById('helpModal');

        // Chatbot elements (NOVO)
        this.chatToggleBtn = document.getElementById('chatToggleBtn');
        this.chatContainer = document.getElementById('chatContainer');
        this.chatCloseBtn = document.getElementById('chatCloseBtn');
        this.chatMessages = document.getElementById('chatMessages');
        this.chatForm = document.getElementById('chatForm');
        this.chatInput = document.getElementById('chatInput');
        this.chatSendBtn = document.getElementById('chatSendBtn');
        this.chatStatus = document.getElementById('chatStatus');
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
        // REMOVIDO: this.detectColumnsBtn.addEventListener('click', this.detectColumns.bind(this));
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

        // API config events
        this.accessToken.addEventListener('input', this.saveApiConfig.bind(this));
        this.phoneNumberId.addEventListener('input', this.saveApiConfig.bind(this));
        this.templateName.addEventListener('input', this.saveApiConfig.bind(this));
        this.languageCode.addEventListener('change', this.saveApiConfig.bind(this));

        // Chatbot events (NOVO)
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

    // NOVO: Lógica do Chatbot
    initializeChat() {
        // Inicializa o histórico do chat com a saudação da AI
        this.addMessage("Olá! Sou o Ajudante Geral a AI que pensa por você. Estou aqui para te ajudar a entender a estrutura do seu arquivo de contatos e como usar todas as funcionalidades do site para envio em massa. O que você gostaria de saber sobre o seu arquivo ou sobre o site?", 'ai', true);
    }
    
    toggleChat() {
        this.chatContainer.classList.toggle('hidden');
        if (!this.chatContainer.classList.contains('hidden')) {
            this.scrollToBottom();
            this.chatInput.focus();
        }
    }
    
    handleChatSubmit(e) {
        e.preventDefault();
        const userMessage = this.chatInput.value.trim();
        if (!userMessage) return;

        this.addMessage(userMessage, 'user');
        this.chatInput.value = '';
        this.chatSendBtn.disabled = true;

        this.callChatAPI(userMessage);
    }

    addMessage(text, role, isSilent = false) {
        // NOVO: Limpa os caracteres "*" e "#" das respostas da AI
        let cleanedText = text;
        if (role === 'ai') {
            cleanedText = text.replace(/[*#]/g, ''); // Remove todos os * e #
        }

        // Limita o histórico a 20 mensagens (10 pares) para evitar sobrecarga no payload
        if (!isSilent && this.chatHistory.length >= 20) {
            this.chatHistory.shift(); // Remove o mais antigo
        }
        
        const messageObject = { role: role, text: cleanedText }; // Usa o cleanedText
        if (!isSilent) {
            this.chatHistory.push(messageObject);
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;

        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${role === 'user' ? 'user-message' : 'ai-message'}`;

        // CORREÇÃO: Remove a dependência do 'marked.js' (que causava o erro)
        // e usa textContent (via escapeHtml) para segurança.
        // Substitui quebras de linha por <br> para formatação básica.
        const formattedText = this.escapeHtml(cleanedText).replace(/\n/g, '<br>'); // Usa o cleanedText
        bubble.innerHTML = formattedText;

        messageDiv.appendChild(bubble);
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    getContactDataSample() {
        // Se os contatos ainda não foram processados, envie uma amostra dos dados brutos
        if (this.processedContacts.length === 0) {
            if (this.contacts.length === 0) return null;
            // Envia apenas as 5 primeiras linhas de dados brutos
            const sample = this.contacts.slice(0, 5);
            // Retorna como JSON stringificado para o backend
            return JSON.stringify({
                status: "processing_not_started",
                sample_data: sample,
                total_contacts: this.contacts.length
            }, null, 2);
        }
        
        // Se os contatos foram processados, envie um resumo inteligente
        const validContacts = this.processedContacts.filter(c => c.status !== 'invalid');
        const invalidContacts = this.processedContacts.filter(c => c.status === 'invalid');

        // Pega amostras de ambos
        const validSample = validContacts.slice(0, 5);
        const invalidSample = invalidContacts.slice(0, 10); // Envia mais inválidos, pois são mais prováveis de serem perguntados

        const summary = {
            status: "processing_complete",
            total_contacts: this.processedContacts.length,
            total_valid: validContacts.length,
            total_invalid: invalidContacts.length,
            // Envia os 10 primeiros contatos inválidos
            invalid_contacts_sample: invalidSample.map(c => ({
                id: c.id,
                aluno: c.aluno,
                responsavel: c.responsavel,
                turma: c.turma,
                telefone_original: c.originalPhone,
                status: c.status
            })),
            // Envia os 5 primeiros contatos válidos
            valid_contacts_sample: validSample.map(c => ({
                id: c.id,
                aluno: c.aluno,
                telefone_formatado: c.cleanedPhone,
                status: c.status
            }))
        };
        
        // Retorna como JSON stringificado para o backend
        return JSON.stringify(summary, null, 2);
    }
    
    async callChatAPI(userMessage, isInitial = false) {
        this.chatStatus.classList.remove('hidden');
        
        const dataSample = this.getContactDataSample();
        
        // O histórico inclui a mensagem atual do usuário (já adicionada via addMessage)
        const historyPayload = this.chatHistory;
        
        const payload = {
            message: userMessage,
            history: historyPayload,
            contact_data_sample: dataSample
        };

        try {
            // Usa o URL base configurado
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
                 // Remove a última mensagem do histórico para que o usuário possa tentar novamente sem poluir
                 this.chatHistory.pop();
                 return;
            }

            const data = await response.json();
            
            // Adiciona a resposta da AI. A função addMessage cuidará de atualizar o histórico.
            this.addMessage(data.response, 'ai');

        } catch (error) {
            console.error('Chat API Error:', error);
            this.addMessage('Desculpe, não foi possível conectar ao assistente de AI. Verifique se o backend do Render está ativo.', 'ai');
            // Remove a última mensagem do histórico em caso de falha de conexão
            this.chatHistory.pop();
        } finally {
            this.chatStatus.classList.add('hidden');
        }
    }
    
    // FIM NOVO: Lógica do Chatbot

    // File Upload Handling
    handleDragOver(e) {
        e.preventDefault();
        this.dropZone.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.dropZone.classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        this.dropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    async processFile(file) {
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
            this.contacts = contacts;
            this.hideProgress();
            
            // *** CORREÇÃO APLICADA AQUI (da 1ª conversa) ***
            // Garante que o mapeamento apareça IMEDIATAMENTE após o parse,
            // antes mesmo da tentativa de AI.
            this.showMappingSection();

            // Tenta a detecção e mapeamento automáticos
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
            this.updatePreview();

        } catch (error) {
            console.error('AI detection failed:', error);
            this.showError('A detecção por AI falhou. Mapeie as colunas manualmente.');
            if (autoMode) {
                 this.aiStatus.querySelector('span').textContent = 'Falha na detecção AI. Por favor, mapeie manualmente.';
            }
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

    // Contact Preview
    updatePreview() {
        const alunoKey = this.alunoColumn.value; // Novo nameKey
        const phoneKey = this.phoneColumn.value;

        if (!alunoKey || !phoneKey) return;
        
        // Coleta as chaves dos campos adicionais
        const responsavelKey = this.responsavelColumn.value;
        const turmaKey = this.turmaColumn.value;

        this.processContacts(alunoKey, phoneKey, responsavelKey, turmaKey);
        this.showPreview();
        this.showMessageSection();
        this.showActionSection();
    }

    processContacts(alunoKey, phoneKey, responsavelKey, turmaKey) {
        const processedList = [];
        const invalidList = [];

        this.contacts.forEach((contact, index) => {
            const aluno = contact[alunoKey] || 'Não Informado';
            const phone = contact[phoneKey] || '';
            
            // Limpa o número e captura DDD e status
            const cleaningResult = NumberCleaner.clean(phone); 
            const cleanedPhone = cleaningResult.cleanedPhone;
            const status = cleaningResult.status;

            const contactData = {
                id: index + 1,
                name: aluno.toString().trim(), // O nome principal para o template
                originalPhone: phone.toString().trim(),
                cleanedPhone: cleanedPhone,
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
        tbody.innerHTML = '';

        // Exibe mais contatos (primeiros 200)
        const displayContacts = this.processedContacts.slice(0, 200); 

        displayContacts.forEach(contact => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';

            const statusIcon = this.getStatusIconHtml(contact.status);
            const statusClass = `status-${contact.status}`;

            // Determina o telefone a ser exibido na prévia (original se inválido, formatado se válido)
            const phoneDisplay = contact.status === 'invalid' 
                                 ? this.escapeHtml(contact.originalPhone || 'Não Informado') 
                                 : this.escapeHtml(contact.cleanedPhone);

            row.innerHTML = `
                <td class="px-4 py-2 text-gray-600">${contact.id}</td>
                <td class="px-4 py-2">${this.escapeHtml(contact.aluno)}</td>
                <td class="px-4 py-2">${this.escapeHtml(contact.responsavel)}</td>
                <td class="px-4 py-2 text-gray-600">${this.escapeHtml(contact.turma)}</td>
                <td class="px-4 py-2 ${contact.status === 'invalid' ? 'text-red-500 font-medium' : ''}">
                    ${phoneDisplay}
                </td>
                <td class="px-4 py-2 text-gray-600">${contact.ddd || '-'}</td>
                <td class="px-4 py-2 ${statusClass}">
                    ${statusIcon}
                </td>
                <td class="px-4 py-2">
                    <button onclick="app.downloadSingleVCF(${contact.id - 1})" 
                            class="text-blue-600 hover:text-blue-800 text-xs disabled:opacity-50"
                            ${contact.status === 'invalid' ? 'disabled' : ''}>
                        <i class="fas fa-download mr-1"></i>VCF
                    </button>
                </td>
            `;

            tbody.appendChild(row);
        });
    }
    
    // Retorna o HTML do ícone de status (Simplificado: Apenas Válido/Inválido)
    getStatusIconHtml(status) {
        switch (status) {
            case 'valid': return '<i class="fas fa-check-circle"></i> Válido';
            case 'invalid': return '<i class="fas fa-times-circle"></i> Inválido';
            default: return 'Inválido'; // Deve ser sempre valid ou invalid após a limpeza
        }
    }


    updateContactName(index, value) {
        if (this.processedContacts[index]) {
            // Atualiza o nome do aluno (name)
            this.processedContacts[index].name = value;
            this.processedContacts[index].aluno = value;
            this.updateMessagePreview();
        }
    }
    
    // Atualiza o número de telefone e reprocessa a lista para manter inválidos no final
    updateContactPhone(index, value) {
        if (this.processedContacts[index]) {
            const contact = this.processedContacts[index];
            const cleaningResult = NumberCleaner.clean(value);
            
            contact.cleanedPhone = cleaningResult.cleanedPhone;
            contact.ddd = cleaningResult.ddd;
            contact.status = cleaningResult.status;
            contact.originalPhone = value;

            // Reorganiza a lista para garantir que inválidos continuem no final
            const validList = this.processedContacts.filter(c => c.status !== 'invalid');
            const invalidList = this.processedContacts.filter(c => c.status === 'invalid');
            this.processedContacts = validList.concat(invalidList);
            
            this.renderContactTable();
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
            this.messagePreview.textContent = preview;
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
            this.generateVcfBtn.style.display = 'none';
            this.sendMessagesBtn.style.display = 'inline-flex';
        } else {
            this.apiConfigSection.classList.add('hidden');
            this.generateVcfBtn.style.display = 'inline-flex';
            this.sendMessagesBtn.style.display = 'none';
        }
    }

    // Action Section
    showActionSection() {
        this.actionSection.classList.remove('hidden');
        this.actionSection.classList.add('fade-in');
        this.toggleMode(); // Update button visibility
    }

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

    downloadSingleVCF(index) {
        const contact = this.processedContacts[index];
        if (!contact || contact.status === 'invalid') return;

        const vcfContent = VCFGenerator.generateSingle(contact);
        const blob = new Blob([vcfContent], { type: 'text/vcard' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${contact.name.replace(/[^a-zA-Z0-9]/g, '_')}.vcf`;
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

    // Modal Management
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
        document.getElementById('progressCount').textContent = `0/${this.processedContacts.length}`;
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
        toast.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 5000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Excel Parser Module
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
                            // Converte todo o conteúdo da célula para string para consistência
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
            // Número fixo ou móvel legado (8 dígitos). Injetamos o 9, o que é apenas formatação para E.164
            // Nota: Não marcamos como 'corrected' porque a regra é: 8 dígitos válidos = 'valid'.
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
        const name = contact.name || 'Unknown';
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
                
                const statusResponse = await fetch(`${API_BASE_URL}/api/job-status/${jobId}`);
                
                // Trata erro 503 (Serviço indisponível, ex: Redis não configurado)
                if (statusResponse.status === 503) {
                     throw new Error('Rastreamento de trabalho (Job tracking) indisponível. Verifique a configuração do Redis no backend.');
                }

                if (!statusResponse.ok) {
                     // Tenta mais uma vez antes de falhar
                     await new Promise(resolve => setTimeout(resolve, 1000));
                     const statusResponseRetry = await fetch(`${API_BASE_URL}/api/job-status/${jobId}`);
                     if (!statusResponseRetry.ok) {
                         const errorDetail = await statusResponseRetry.json().catch(() => ({ detail: 'Erro de rede desconhecido' }));
                         throw new Error(`Falha ao obter o status do trabalho: ${errorDetail.detail}`);
                     }
                     
                     // Atualiza os dados do status se o retry funcionar
                     const statusData = await statusResponseRetry.json();
                     status = statusData.status;
                     totalSent = statusData.completed || 0;
                     totalFailed = statusData.failed || 0;
                     results = statusData.results || [];
                } else {
                    const statusData = await statusResponse.json();
                    status = statusData.status;
                    totalSent = statusData.completed || 0;
                    totalFailed = statusData.failed || 0;
                    results = statusData.results || [];
                }
                
                if (onProgress) {
                    onProgress({
                        current: totalSent + totalFailed,
                        total: totalContacts,
                        message: `Processados: ${totalSent} com sucesso, ${totalFailed} com falha.`
                    });
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

// Adiciona a biblioteca marked para renderização de markdown no chat
// document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/4.0.12/marked.min.js"></script>');
// ^^^ CORREÇÃO: Linha removida para evitar que a página quebre.

// Initialize Application
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new WhatsAppBulkManager();
});
