<?php
/**
 * Guia de Segurança e Sanitização (PHP) - 8 de Novembro de 2025
 *
 * NOTA IMPORTANTE:
 * O stack atual desta aplicação é (Frontend: HTML/JS) -> (Backend: Python/FastAPI).
 * Este arquivo PHP serve como um GUIA DE BOAS PRÁTICAS e DOCUMENTAÇÃO MODULAR
 * de como as proteções solicitadas (LGPD, Anti-XSS, Anti-Hacking)
 * seriam implementadas em um ambiente de servidor PHP.
 *
 * As proteções REAIS deste projeto estão implementadas em:
 * 1. `proxy_server.py`: Proteção de servidor (Firewall, Logs, Validação de API).
 * 2. `main.js`: Proteção de cliente (Higienização de XSS com escapeHtml).
 * 3. `index.html`: Política de Transparência (Modal de Ajuda da LGPD).
 */

// ========================================================================
// Medida: Proteção contra Hacking (XSS - Cross-Site Scripting)
// ========================================================================

/**
 * Em PHP, NUNCA imprima dados do usuário diretamente no HTML.
 * Use `htmlspecialchars` para converter caracteres especiais em entidades HTML.
 *
 * Proteção EQUIVALENTE no `main.js`: A função `app.escapeHtml(text)`.
 */
function display_data($data) {
    // PREVENÇÃO DE XSS:
    // Converte < em &lt;, > em &gt;, etc.
    // Isso impede que um usuário que enviou "<script>alert(1)</script>"
    // como "nome" execute o script no navegador.
    echo htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
}

// Exemplo de uso seguro:
// $nome_do_aluno_do_excel = '<script>alert("XSS")</script>';
// <div class="nome">
//     <?php display_data($nome_do_aluno_do_excel); ?> 
// </div>
// O HTML resultante será (SEGURO):
// <div class="nome">
//     &lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;
// </div>


// ========================================================================
// Medida: Proteção contra Hacking (SQL Injection)
// ========================================================================

/**
 * Em PHP, NUNCA construa queries de banco de dados concatenando strings.
 * Use SEMPRE Prepared Statements (Declarações Preparadas) com PDO ou MySQLi.
 *
 * Proteção EQUIVALENTE no `proxy_server.py`:
 * Não usamos SQL, mas a validação de entrada com Pydantic e a
 * higienização de IDs no endpoint `/api/job-status/{job_id}` previnem
 * ataques de injeção de parâmetros no Redis.
 */
function get_user_data(PDO $pdo, $user_id) {
    // NÃO FAÇA ISSO (Vulnerável a SQL Injection):
    // $sql = "SELECT * FROM users WHERE id = '" . $user_id . "'";

    // FAÇA ISSO (Seguro - Prepared Statement):
    // 1. O '?' é um placeholder.
    $sql = "SELECT * FROM users WHERE id = ?";
    
    // 2. Prepara a query
    $stmt = $pdo->prepare($sql);
    
    // 3. Executa, passando os dados do usuário com segurança.
    // O driver do banco de dados higieniza $user_id internamente.
    $stmt->execute([$user_id]);
    
    return $stmt->fetch();
}


// ========================================================================
// Medida: LGPD - Controle de Acesso (IAM) e Proteção de Senhas
// ========================================================================

/**
 * Em PHP, gerencie sessões de forma segura para controlar o acesso.
 *
 * Proteção EQUIVALENTE no `proxy_server.py`:
 * Verificamos o `accessToken` enviado no Header/Body para
 * autenticar as requisições à API do WhatsApp.
 */

// 1. Inicie sessões com configurações seguras
ini_set('session.cookie_httponly', 1); // Impede JS de ler o cookie
ini_set('session.cookie_secure', 1);   // Só envia cookie por HTTPS
session_start();

// 2. Armazene senhas com hash (NUNCA texto puro)
// $senha_do_usuario = "123456";
// $hash_para_salvar_no_db = password_hash($senha_do_usuario, PASSWORD_ARGON2ID);

// 3. Verifique a senha
// $hash_do_db = ... (busca do banco) ...
// if (password_verify($senha_do_usuario, $hash_do_db)) {
//     // Senha correta
//     session_regenerate_id(true); // Previne "Session Fixation"
//     $_SESSION['user_id'] = $user_id;
//     $_SESSION['logged_in'] = true;
// }

// 4. Verifique o acesso em todas as páginas protegidas
function require_login() {
    if (empty($_SESSION['logged_in'])) {
        http_response_code(403); // Forbidden
        echo "Acesso Negado.";
        exit;
    }
}
// Ex: require_login(); no topo de `admin.php`


// ========================================================================
// Medida: LGPD - Criptografia (SSL/TLS)
// ========================================================================

/**
 * Em PHP, force o usuário a usar HTTPS.
 *
 * Proteção EQUIVALENTE:
 * Isso é feito no nível do SERVIDOR (Render, Cloudflare, Nginx, Apache),
 * e não no código da aplicação. O Render força HTTPS por padrão.
 */
function force_https() {
    if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') {
        $location = 'https://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
        header('HTTP/1.1 301 Moved Permanently');
        header('Location: ' . $location);
        exit;
    }
}
// Ex: force_https(); no topo do seu `index.php`


// ========================================================================
// Medida: Proteção contra Hacking (Engenharia Social, Pseudo Hacking)
// ========================================================================

/**
 * A melhor proteção é a Validação de Entrada (Input Validation) e
 * a Limitação de Taxa (Rate Limiting).
 *
 * Proteção EQUIVALENTE no `proxy_server.py`:
 * - `check_rate_limit()`: Bloqueia IPs com muitas requisições.
 * - Modelos Pydantic: Rejeitam requisições com formatos inesperados.
 */
function validate_input($input, $type = 'text') {
    // 1. Remove espaços em branco
    $input = trim($input);
    
    // 2. Higieniza (Previna XSS)
    $input = htmlspecialchars($input, ENT_QUOTES, 'UTF-8');
    
    // 3. Valida o formato (Exemplo para um ID numérico)
    if ($type === 'id') {
        if (!filter_var($input, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]])) {
            // Se não for um inteiro positivo, é um ataque ou erro.
            return false;
        }
    }
    
    // 4. Valida o formato (Exemplo para Telefone)
    if ($type === 'phone') {
        // Remove tudo exceto dígitos
        $digits = preg_replace('/\D/', '', $input);
        if (strlen($digits) < 10 || strlen($digits) > 13) {
            // Número inválido (provável tentativa de injeção)
            return false;
        }
        return $digits;
    }
    
    return $input;
}

// $job_id_malicioso = "123; DROP TABLE users; --";
// $job_id_seguro = validate_input($job_id_malicioso, 'id');
// if ($job_id_seguro === false) {
//     // Medida: Resposta a Incidentes (Loga a tentativa)
//     error_log("Tentativa de Hacking (Input Validation Failed): " . $job_id_malicioso);
//     die("Entrada inválida.");
// }


// ========================================================================
// Medida: LGPD - Monitoramento e Logs / Resposta a Incidentes
// ========================================================================

/**
 * Em PHP, use `error_log()` para registrar eventos de segurança.
 * NUNCA logue dados sensíveis (senhas, cartões, listas de contato).
 *
 * Proteção EQUIVALENTE no `proxy_server.py`:
 * Usamos a biblioteca `logging` do Python (ex: `logging.error(...)`).
 */
function log_security_event($message, $level = 'WARNING') {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN_IP';
    
    // LGPD: Minimização de Dados no Log (Logamos o IP, mas não dados do usuário)
    error_log("[$level] [SEGURANCA_LOG] IP: $ip - $message");
    
    // Medida: Resposta a Incidentes (Se for crítico, envia um alerta)
    if ($level === 'CRITICAL') {
        // mail('admin@seu-site.com', 'ALERTA DE SEGURANÇA CRÍTICO', $message);
    }
}

// Exemplo:
// $user_id = validate_input($_POST['user_id'], 'id');
// if ($user_id === false) {
//     log_security_event("Tentativa de acesso com ID inválido: " . $_POST['user_id'], 'CRITICAL');
//     die("Acesso negado.");
// }

?>