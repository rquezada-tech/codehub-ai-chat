<?php
/**
 * Plugin Name: CodeHub AI Advisor
 * Description: AI chatbot advisor for WooCommerce product consultation with ERPNext CRM integration.
 * Version: 0.1.0
 * Author: CodeHub
 * Requires Plugins: woocommerce
 * Text Domain: codehub-ai-advisor
 */

if (!defined('ABSPATH')) {
    exit;
}

define('CH_AI_VERSION', '0.1.0');
define('CH_AI_PLUGIN_FILE', __FILE__);
define('CH_AI_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('CH_AI_PLUGIN_URL', plugin_dir_url(__FILE__));

require_once CH_AI_PLUGIN_DIR . 'includes/class-settings.php';
require_once CH_AI_PLUGIN_DIR . 'includes/class-api-client.php';
require_once CH_AI_PLUGIN_DIR . 'includes/class-widget.php';
require_once CH_AI_PLUGIN_DIR . 'includes/class-erpnext.php';

add_action('plugins_loaded', function () {
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', function () {
            echo '<div class="notice notice-error"><p>CodeHub AI Advisor requiere WooCommerce activo.</p></div>';
        });
        return;
    }

    CH_AI_Settings::init();
    CH_AI_Widget::init();
    CH_AI_ERPNext::init();
});

// Register REST API endpoints
add_action('rest_api_init', function () {
    register_rest_route('codehub-ai/v1', '/chat', array(
        'methods' => 'POST',
        'callback' => function ($request) {
            $client = new CH_AI_API_Client();
            $result = $client->chat($request->get_param('message'), $request->get_param('history'));

            if (is_wp_error($result)) {
                return new WP_Error('chat_error', $result->get_error_message(), array('status' => 500));
            }

            return $result;
        },
        'permission_callback' => '__return_true',
    ));

    register_rest_route('codehub-ai/v1', '/erpnext/login', array(
        'methods' => 'POST',
        'callback' => function ($request) {
            $erp = new CH_AI_ERPNext();
            return $erp->login($request);
        },
        'permission_callback' => '__return_true',
    ));

    register_rest_route('codehub-ai/v1', '/erpnext/lead', array(
        'methods' => 'POST',
        'callback' => function ($request) {
            $erp = new CH_AI_ERPNext();
            return $erp->create_lead($request);
        },
        'permission_callback' => '__return_true',
    ));
});
