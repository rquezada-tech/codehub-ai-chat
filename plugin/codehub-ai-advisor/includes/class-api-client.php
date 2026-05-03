<?php
/**
 * API Client for CodeHub AI Chat Service
 */

class CH_AI_API_Client {

    private $apiUrl;
    private $apiKey;

    public function __construct() {
        $this->apiUrl = rtrim(get_option('ch_ai_api_url', 'https://ia.codehub.cl'), '/');
        $this->apiKey = get_option('ch_ai_api_key', '');
    }

    /**
     * Send a chat message to the AI service
     */
    public function chat($message, $history = [], $systemPrompt = null) {
        $args = [
            'message' => sanitize_text_field($message),
            'conversationHistory' => $history,
        ];

        if ($systemPrompt) {
            $args['systemPrompt'] = $systemPrompt;
        }

        $response = wp_remote_post($this->apiUrl . '/chat', [
            'headers' => [
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
            ],
            'body' => json_encode($args),
            'timeout' => 60, // LLM puede tardar
        ]);

        if (is_wp_error($response)) {
            return $response;
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if (wp_remote_retrieve_response_code($response) !== 200) {
            return new WP_Error(
                'api_error',
                isset($data['error']) ? $data['error'] : 'Unknown error',
                isset($data['details']) ? $data['details'] : ''
            );
        }

        return $data;
    }

    /**
     * Search products via the AI API
     */
    public function searchProducts($query, $limit = 20) {
        $response = wp_remote_get(
            $this->apiUrl . '/products/search?q=' . urlencode($query) . '&limit=' . $limit,
            [
                'headers' => [
                    'Authorization' => 'Bearer ' . $this->apiKey,
                ],
                'timeout' => 30,
            ]
        );

        if (is_wp_error($response)) {
            return $response;
        }

        return json_decode(wp_remote_retrieve_body($response), true);
    }

    /**
     * Test connection to the API
     */
    public function testConnection() {
        $response = wp_remote_get($this->apiUrl . '/health', [
            'headers' => [
                'X-API-Key' => $this->apiKey,
            ],
            'timeout' => 10,
        ]);

        if (is_wp_error($response)) {
            return [
                'success' => false,
                'message' => $response->get_error_message(),
            ];
        }

        $code = wp_remote_retrieve_response_code($response);
        return [
            'success' => $code === 200,
            'message' => $code === 200 ? 'Connected' : 'HTTP ' . $code,
        ];
    }

    /**
     * Get featured products
     */
    public function getFeaturedProducts($limit = 8) {
        $response = wp_remote_get(
            $this->apiUrl . '/products/featured?limit=' . $limit,
            [
                'headers' => [
                    'Authorization' => 'Bearer ' . $this->apiKey,
                ],
                'timeout' => 30,
            ]
        );

        if (is_wp_error($response)) {
            return $response;
        }

        return json_decode(wp_remote_retrieve_body($response), true);
    }
}
