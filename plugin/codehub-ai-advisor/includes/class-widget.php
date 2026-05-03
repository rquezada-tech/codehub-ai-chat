<?php
/**
 * Chat Widget Frontend
 */

class CH_AI_Widget {

    public static function init() {
        add_action('wp_enqueue_scripts', [self::class, 'enqueueAssets']);
        add_action('wp_footer', [self::class, 'renderWidget']);
        add_action('wp_ajax_ch_ai_send_message', [self::class, 'handleChatMessage']);
        add_action('wp_ajax_nopriv_ch_ai_send_message', [self::class, 'handleChatMessage']);
    }

    public static function enqueueAssets() {
        if (is_admin()) return;

        $plugin_url = CH_AI_PLUGIN_URL;
        $version = CH_AI_VERSION;

        wp_enqueue_style(
            'ch-ai-widget',
            $plugin_url . 'assets/css/widget.css',
            [],
            $version
        );

        wp_enqueue_script(
            'ch-ai-widget',
            $plugin_url . 'assets/js/widget.js',
            ['jquery'],
            $version,
            true
        );

        wp_localize_script('ch-ai-widget', 'chAiConfig', [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'apiUrl' => get_rest_url(null, 'codehub-ai/v1'),
            'nonce' => wp_create_nonce('ch_ai_nonce'),
            'debug' => defined('WP_DEBUG') && WP_DEBUG,
        ]);
    }

    public static function renderWidget() {
        $widget_title = apply_filters('ch_ai_widget_title', 'Asesor AI');
        $welcome_message = apply_filters(
            'ch_ai_welcome_message',
            '¡Hola! Soy tu asesor de CodeHub. ¿En qué puedo ayudarte hoy? Puedo ayudarte a encontrar productos, comparar opciones y generar cotizaciones.'
        );
        ?>
        <div id="ch-ai-chat-widget" class="ch-ai-collapsed" role="dialog" aria-label="Chat de asesor virtual">
            <div class="ch-ai-header" onclick="toggleChAiWidget()" role="button" tabindex="0" aria-expanded="false">
                <div class="ch-ai-header-content">
                    <span class="ch-ai-icon">💬</span>
                    <span class="ch-ai-title"><?php echo esc_html($widget_title); ?></span>
                </div>
                <span class="ch-ai-toggle" aria-hidden="true">▼</span>
            </div>

            <div class="ch-ai-body">
                <div class="ch-ai-status-bar" id="ch-ai-status">
                    <span class="ch-ai-status-dot"></span>
                    <span class="ch-ai-status-text">Conectando...</span>
                </div>

                <div class="ch-ai-messages" id="ch-ai-messages" role="log" aria-live="polite">
                    <div class="ch-ai-message ch-ai-bot">
                        <div class="ch-ai-message-content"><?php echo esc_html($welcome_message); ?></div>
                    </div>
                </div>

                <div class="ch-ai-typing" id="ch-ai-typing" style="display: none;">
                    <div class="ch-ai-typing-dots">
                        <span></span><span></span><span></span>
                    </div>
                    <span>El asesor está escribiendo...</span>
                </div>

                <div class="ch-ai-input-area">
                    <input
                        type="text"
                        id="ch-ai-input"
                        class="ch-ai-input"
                        placeholder="Escribe tu pregunta..."
                        aria-label="Mensaje"
                        maxlength="1000"
                        autocomplete="off"
                    />
                    <button
                        type="button"
                        id="ch-ai-send-btn"
                        class="ch-ai-send-btn"
                        onclick="sendChAiMessage()"
                        aria-label="Enviar mensaje"
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20">
                            <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                    </button>
                </div>

                <div class="ch-ai-quick-actions" id="ch-ai-quick-actions">
                    <button onclick="sendQuickMessage('Ver productos en oferta')">🛍️ Ver ofertas</button>
                    <button onclick="sendQuickMessage('Necesito ayuda para elegir un producto')">❓ Ayuda</button>
                    <button onclick="sendQuickMessage('Generar cotización')">📋 Cotización</button>
                </div>
            </div>
        </div>

        <script>
        // Quick action helper
        function sendQuickMessage(message) {
            document.getElementById('ch-ai-input').value = message;
            sendChAiMessage();
        }
        </script>
        <?php
    }

    public static function handleChatMessage() {
        check_ajax_referer('ch_ai_nonce', 'nonce');

        $message = sanitize_text_field($_POST['message'] ?? '');
        $history = isset($_POST['history']) ? json_decode(stripslashes($_POST['history']), true) : [];

        if (empty($message)) {
            wp_send_json_error(['message' => 'Message is required']);
        }

        // Call the REST API
        $response = wp_remote_post(get_rest_url(null, 'codehub-ai/v1/chat'), [
            'headers' => [
                'Content-Type' => 'application/json',
            ],
            'body' => json_encode([
                'message' => $message,
                'history' => $history,
            ]),
            'timeout' => 60,
        ]);

        if (is_wp_error($response)) {
            wp_send_json_error(['message' => $response->get_error_message()]);
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code !== 200) {
            wp_send_json_error([
                'message' => $body['error'] ?? 'Error del servidor',
                'details' => $body['details'] ?? ''
            ]);
        }

        wp_send_json_success($body);
    }
}
