<?php
/**
 * ERPNext Integration for CodeHub AI Advisor
 */

class CH_AI_ERPNext {

    private $erpUrl;
    private $email;
    private $password;
    private $cookies;

    public function __construct() {
        $this->erpUrl = rtrim(get_option('ch_ai_erpnext_url', 'https://erpnext.codehub.cl'), '/');
        $this->email = get_option('ch_ai_erpnext_email', '');
        $this->password = get_option('ch_ai_erpnext_password', '');
        $this->cookies = get_transient('ch_ai_erpnext_cookies');
    }

    public static function init() {
        add_action('rest_api_init', function () {
            // Registered in main plugin file
        });
    }

    /**
     * Login to ERPNext and store session cookies
     */
    public function login($request = null) {
        $email = $request ? $request->get_param('email') : $this->email;
        $password = $request ? $request->get_param('password') : $this->password;

        if (empty($email) || empty($password)) {
            return new WP_Error('missing_credentials', 'Email and password required', ['status' => 400]);
        }

        $response = wp_remote_post($this->erpUrl . '/api/method/login', [
            'headers' => ['Content-Type' => 'application/json'],
            'body' => json_encode(['usr' => $email, 'pwd' => $password]),
            'timeout' => 30,
        ]);

        if (is_wp_error($response)) {
            return new WP_Error('connection_error', $response->get_error_message(), ['status' => 500]);
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        if (!isset($body['message']) || $body['message'] !== 'Logged In') {
            return new WP_Error('auth_failed', 'Invalid credentials', ['status' => 401]);
        }

        // Store cookies for subsequent requests
        $cookies = wp_remote_retrieve_headers($response)->get('set-cookie');
        if ($cookies) {
            $this->cookies = $cookies;
            set_transient('ch_ai_erpnext_cookies', $cookies, HOUR_IN_SECONDS * 8);
        }

        return [
            'success' => true,
            'message' => 'Logged In',
        ];
    }

    /**
     * Create a lead in ERPNext
     */
    public function create_lead($request) {
        if (!$this->cookies) {
            // Try to login first
            $login = $this->login();
            if (is_wp_error($login)) {
                return $login;
            }
        }

        $params = $request->get_json_params();

        $data = [
            'lead_name' => isset($params['company']) && $params['company']
                ? sanitize_text_field($params['company'])
                : sanitize_text_field($params['firstName']) . ' ' . sanitize_text_field($params['lastName']),
            'first_name' => sanitize_text_field($params['firstName'] ?? ''),
            'last_name' => sanitize_text_field($params['lastName'] ?? ''),
            'email_id' => sanitize_email($params['email'] ?? ''),
            'phone' => sanitize_text_field($params['phone'] ?? ''),
            'notes' => sanitize_textarea_field($params['notes'] ?? ''),
            'source' => 'Chat Widget',
        ];

        $response = $this->api_request('POST', '/api/resource/Lead', $data);

        if (is_wp_error($response)) {
            return $response;
        }

        return [
            'success' => true,
            'id' => $response['data']['name'] ?? null,
            'type' => 'Lead',
        ];
    }

    /**
     * Create a customer in ERPNext
     */
    public function create_customer($request) {
        if (!$this->cookies) {
            $login = $this->login();
            if (is_wp_error($login)) {
                return $login;
            }
        }

        $params = $request->get_json_params();

        $data = [
            'customer_name' => isset($params['company']) && $params['company']
                ? sanitize_text_field($params['company'])
                : sanitize_text_field($params['firstName']) . ' ' . sanitize_text_field($params['lastName']),
            'first_name' => sanitize_text_field($params['firstName'] ?? ''),
            'last_name' => sanitize_text_field($params['lastName'] ?? ''),
            'email_id' => sanitize_email($params['email'] ?? ''),
            'phone' => sanitize_text_field($params['phone'] ?? ''),
            'customer_type' => isset($params['company']) && $params['company'] ? 'Company' : 'Individual',
        ];

        $response = $this->api_request('POST', '/api/resource/Customer', $data);

        if (is_wp_error($response)) {
            return $response;
        }

        return [
            'success' => true,
            'id' => $response['data']['name'] ?? null,
            'type' => 'Customer',
        ];
    }

    /**
     * Create a sales order in ERPNext
     */
    public function create_sales_order($request) {
        if (!$this->cookies) {
            $login = $this->login();
            if (is_wp_error($login)) {
                return $login;
            }
        }

        $params = $request->get_json_params();

        if (empty($params['customerId']) || empty($params['items'])) {
            return new WP_Error('missing_params', 'customerId and items required', ['status' => 400]);
        }

        $items = array_map(function($item) {
            return [
                'item_code' => sanitize_text_field($item['itemCode'] ?? $item['item_code'] ?? ''),
                'qty' => floatval($item['qty'] ?? $item['quantity'] ?? 1),
                'rate' => floatval($item['rate'] ?? $item['price'] ?? 0),
            ];
        }, $params['items']);

        $data = [
            'customer' => sanitize_text_field($params['customerId']),
            'items' => $items,
            'notes' => sanitize_textarea_field($params['notes'] ?? 'Order from Chat Widget'),
        ];

        $response = $this->api_request('POST', '/api/resource/Sales Order', $data);

        if (is_wp_error($response)) {
            return $response;
        }

        return [
            'success' => true,
            'id' => $response['data']['name'] ?? null,
        ];
    }

    /**
     * Make authenticated request to ERPNext API
     */
    private function api_request($method, $endpoint, $data = null) {
        $headers = [
            'Content-Type' => 'application/json',
            'Cookie' => is_array($this->cookies) ? implode('; ', $this->cookies) : $this->cookies,
        ];

        $args = [
            'method' => $method,
            'headers' => $headers,
            'timeout' => 30,
        ];

        if ($data) {
            $args['body'] = json_encode($data);
        }

        $response = wp_remote_request($this->erpUrl . $endpoint, $args);

        if (is_wp_error($response)) {
            return $response;
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code >= 400) {
            $error = $body['exception'] ?? $body['_server_messages'] ?? 'API Error';
            return new WP_Error('api_error', $error, ['status' => $code]);
        }

        return $body;
    }
}
