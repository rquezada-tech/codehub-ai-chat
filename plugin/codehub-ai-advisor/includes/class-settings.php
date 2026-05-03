<?php
/**
 * Admin Settings for CodeHub AI Advisor
 */

class CH_AI_Settings {

    public static function init() {
        add_action('admin_menu', [self::class, 'addSettingsPage']);
        add_action('admin_init', [self::class, 'registerSettings']);
    }

    public static function addSettingsPage() {
        add_options_page(
            'CodeHub AI Advisor',
            'AI Advisor',
            'manage_options',
            'codehub-ai-advisor',
            [self::class, 'renderSettingsPage']
        );
    }

    public static function registerSettings() {
        // API Configuration
        register_setting('codehub_ai_advisor', 'ch_ai_api_url');
        register_setting('codehub_ai_advisor', 'ch_ai_api_key');

        // Prompt Configuration
        register_setting('codehub_ai_advisor', 'ch_ai_system_prompt');

        // ERPNext Configuration
        register_setting('codehub_ai_advisor', 'ch_ai_erpnext_url');
        register_setting('codehub_ai_advisor', 'ch_ai_erpnext_email');
        register_setting('codehub_ai_advisor', 'ch_ai_erpnext_password');

        // Add settings sections
        add_settings_section(
            'ch_ai_api_section',
            'Configuración del API de Chat',
            function() {
                echo '<p>Configura la conexión al servidor de chat AI en <code>ia.codehub.cl</code></p>';
            },
            'codehub-ai-advisor'
        );

        add_settings_section(
            'ch_ai_prompt_section',
            'Configuración de Prompts',
            function() {
                echo '<p>Personaliza el comportamiento del asesor IA. Deja vacío para usar el prompt por defecto.</p>';
            },
            'codehub-ai-advisor'
        );

        add_settings_section(
            'ch_ai_erpnext_section',
            'Configuración ERPNext CRM',
            function() {
                echo '<p>Conecta con ERPNext para registrar leads y crear órdenes de venta automáticamente.</p>';
            },
            'codehub-ai-advisor'
        );

        // API Fields
        add_settings_field('ch_ai_api_url', 'URL del API', function() {
            $value = get_option('ch_ai_api_url', 'https://ia.codehub.cl');
            echo '<input type="text" name="ch_ai_api_url" value="' . esc_attr($value) . '" class="regular-text" placeholder="https://ia.codehub.cl" />';
            echo '<p class="description">URL del servicio de chat (subdominio ia.codehub.cl)</p>';
        }, 'codehub-ai-advisor', 'ch_ai_api_section');

        add_settings_field('ch_ai_api_key', 'API Key', function() {
            $value = get_option('ch_ai_api_key', '');
            echo '<input type="password" name="ch_ai_api_key" value="' . esc_attr($value) . '" class="regular-text" autocomplete="new-password" />';
            echo '<p class="description">Clave secreta para autenticar las requests al API de chat</p>';
        }, 'codehub-ai-advisor', 'ch_ai_api_section');

        // Prompt Fields
        add_settings_field('ch_ai_system_prompt', 'Prompt del Sistema', function() {
            $value = get_option('ch_ai_system_prompt', '');
            echo '<textarea name="ch_ai_system_prompt" rows="8" class="large-text code">' . esc_textarea($value) . '</textarea>';
            echo '<p class="description">Instrucciones para el asesor IA. Usa variables como {products} para contexto.</p>';
        }, 'codehub-ai-advisor', 'ch_ai_prompt_section');

        // ERPNext Fields
        add_settings_field('ch_ai_erpnext_url', 'URL de ERPNext', function() {
            $value = get_option('ch_ai_erpnext_url', 'https://erpnext.codehub.cl');
            echo '<input type="text" name="ch_ai_erpnext_url" value="' . esc_attr($value) . '" class="regular-text" />';
        }, 'codehub-ai-advisor', 'ch_ai_erpnext_section');

        add_settings_field('ch_ai_erpnext_email', 'Email de Usuario', function() {
            $value = get_option('ch_ai_erpnext_email', 'rquezada@codehub.cl');
            echo '<input type="email" name="ch_ai_erpnext_email" value="' . esc_attr($value) . '" class="regular-text" />';
        }, 'codehub-ai-advisor', 'ch_ai_erpnext_section');

        add_settings_field('ch_ai_erpnext_password', 'Contraseña', function() {
            $value = get_option('ch_ai_erpnext_password', '');
            echo '<input type="password" name="ch_ai_erpnext_password" value="' . esc_attr($value) . '" class="regular-text" autocomplete="new-password" />';
            echo '<p class="description">La contraseña se guarda de forma encriptada.</p>';
        }, 'codehub-ai-advisor', 'ch_ai_erpnext_section');
    }

    public static function renderSettingsPage() {
        if (!current_user_can('manage_options')) {
            return;
        }
        ?>
        <div class="wrap">
            <h1>CodeHub AI Advisor</h1>

            <form method="post" action="options.php">
                <?php
                settings_fields('codehub_ai_advisor');
                do_settings_sections('codehub-ai-advisor');
                submit_button();
                ?>
            </form>

            <hr />

            <h2>Estados del Sistema</h2>
            <table class="widefat">
                <thead>
                    <tr>
                        <th>Componente</th>
                        <th>Estado</th>
                        <th>Última verificación</th>
                    </tr>
                </thead>
                <tbody id="ch-ai-status-list">
                    <tr>
                        <td>API de Chat</td>
                        <td><span class="ch-ai-status" data-check="api">Verificando...</span></td>
                        <td>-</td>
                    </tr>
                    <tr>
                        <td>ERPNext</td>
                        <td><span class="ch-ai-status" data-check="erpnext">Verificando...</span></td>
                        <td>-</td>
                    </tr>
                </tbody>
            </table>

            <hr />

            <h2>Referencia de Prompts</h2>
            <p>El sistema soporta las siguientes variables en los prompts:</p>
            <ul>
                <li><code>{products}</code> - Lista de productos con información (nombre, SKU, precio, stock)</li>
                <li><code>{customer}</code> - Información del cliente (nombre, email)</li>
                <li><code>{session_id}</code> - ID de la sesión de conversación</li>
            </ul>

            <h3>Ejemplo de Prompt Personalizado</h3>
            <textarea readonly rows="6" class="code" style="width: 100%; max-width: 600px;">Eres un asesor técnico especializado de CodeHub Store.
Ayudas a los clientes a elegir productos según sus necesidades técnicas.
Responde en español, sé conciso y profesional.
Solo recomienda productos que estén disponibles en stock.</textarea>
        </div>

        <script>
        jQuery(document).ready(function($) {
            function checkStatus(type, $el) {
                $.post(ajaxurl, {
                    action: 'ch_ai_check_' + type
                }, function(resp) {
                    if (resp.success) {
                        $el.html('<span style="color: green">✓ ' + resp.data.message + '</span>');
                    } else {
                        $el.html('<span style="color: red">✗ ' + (resp.data.message || 'Error') + '</span>');
                    }
                    $el.siblings('td').last().text(new Date().toLocaleString('es-CL'));
                }).fail(function() {
                    $el.html('<span style="color: red">✗ Error de conexión</span>');
                });
            }

            $('.ch-ai-status').each(function() {
                var type = $(this).data('check');
                checkStatus(type, $(this));
            });
        });
        </script>

        <style>
        .ch-ai-status { font-weight: bold; }
        </style>
        <?php
    }
}

// AJAX handlers for status checks
add_action('wp_ajax_ch_ai_check_api', function() {
    $apiUrl = get_option('ch_ai_api_url', 'https://ia.codehub.cl');
    $apiKey = get_option('ch_ai_api_key', '');

    $response = wp_remote_get($apiUrl . '/health', [
        'headers' => [
            'X-API-Key' => $apiKey,
        ],
        'timeout' => 10,
    ]);

    if (is_wp_error($response)) {
        wp_send_json_error(['message' => $response->get_error_message()]);
    }

    $code = wp_remote_retrieve_response_code($response);
    if ($code === 200) {
        wp_send_json_success(['message' => 'API accessible']);
    } else {
        wp_send_json_error(['message' => 'API returned HTTP ' . $code]);
    }
});

add_action('wp_ajax_ch_ai_check_erpnext', function() {
    $erpUrl = get_option('ch_ai_erpnext_url', 'https://erpnext.codehub.cl');
    $email = get_option('ch_ai_erpnext_email', '');
    $password = get_option('ch_ai_erpnext_password', '');

    if (empty($email) || empty($password)) {
        wp_send_json_error(['message' => 'Credentials not configured']);
    }

    $response = wp_remote_post($erpUrl . '/api/method/login', [
        'headers' => ['Content-Type' => 'application/json'],
        'body' => json_encode(['usr' => $email, 'pwd' => $password]),
        'timeout' => 10,
    ]);

    if (is_wp_error($response)) {
        wp_send_json_error(['message' => $response->get_error_message()]);
    }

    $body = json_decode(wp_remote_retrieve_body($response), true);
    if ($body['message'] === 'Logged In') {
        wp_send_json_success(['message' => 'ERPNext connected']);
    } else {
        wp_send_json_error(['message' => 'Login failed']);
    }
});
