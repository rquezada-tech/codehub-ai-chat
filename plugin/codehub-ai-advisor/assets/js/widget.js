/**
 * CodeHub AI Advisor - Chat Widget JavaScript
 */

(function() {
    'use strict';

    // State
    let conversationHistory = [];
    let isExpanded = false;

    // DOM Elements
    const widget = document.getElementById('ch-ai-chat-widget');
    const messagesContainer = document.getElementById('ch-ai-messages');
    const inputField = document.getElementById('ch-ai-input');
    const sendBtn = document.getElementById('ch-ai-send-btn');
    const statusDot = document.querySelector('.ch-ai-status-dot');
    const statusText = document.querySelector('.ch-ai-status-text');
    const typingIndicator = document.getElementById('ch-ai-typing');

    // Initialize
    function init() {
        if (!widget || !messagesContainer || !inputField) {
            console.warn('[CodeHub AI] Widget elements not found');
            return;
        }

        // Event listeners
        inputField.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        sendBtn.addEventListener('click', sendMessage);

        // Update status
        updateStatus('connecting');

        // Check API health
        checkApiHealth();

        // Focus input when expanded
        widget.querySelector('.ch-ai-header').addEventListener('click', function() {
            if (isExpanded) {
                inputField.focus();
            }
        });

        // Expose to global for quick actions
        window.sendChAiMessage = sendMessage;
        window.sendQuickMessage = sendQuickMessage;
    }

    // Toggle widget
    window.toggleChAiWidget = function() {
        isExpanded = !isExpanded;
        widget.classList.toggle('ch-ai-collapsed', !isExpanded);
        widget.classList.toggle('ch-ai-expanded', isExpanded);

        const toggle = widget.querySelector('.ch-ai-toggle');
        const header = widget.querySelector('.ch-ai-header');

        toggle.textContent = isExpanded ? '▲' : '▼';
        header.setAttribute('aria-expanded', isExpanded);

        if (isExpanded) {
            inputField.focus();
        }
    };

    // Update connection status
    function updateStatus(status, message) {
        if (!statusDot || !statusText) return;

        statusDot.className = 'ch-ai-status-dot ' + status;

        switch(status) {
            case 'connected':
                statusText.textContent = message || 'Conectado';
                break;
            case 'error':
                statusText.textContent = message || 'Error de conexión';
                break;
            default:
                statusText.textContent = message || 'Conectando...';
        }
    }

    // Check API health
    async function checkApiHealth() {
        try {
            const response = await fetch(chAiConfig.apiUrl + '/chat', {
                method: 'HEAD',
                headers: {
                    'Authorization': 'Bearer ' + getApiKey(),
                }
            });

            if (response.ok || response.status === 401) {
                // 401 means auth required (good!)
                updateStatus('connected', 'Listo para ayudarte');
            } else {
                updateStatus('error', 'Servicio no disponible');
            }
        } catch (error) {
            updateStatus('error', 'Sin conexión');
        }
    }

    // Get API key from WordPress
    function getApiKey() {
        // This will be passed from WordPress via localized script
        return window.chAiConfig?.apiKey || '';
    }

    // Send message
    async function sendMessage() {
        const message = inputField.value.trim();

        if (!message) return;

        // Disable input while sending
        inputField.value = '';
        inputField.disabled = true;
        sendBtn.disabled = true;

        // Add user message to UI
        appendMessage(message, 'user');
        conversationHistory.push({ role: 'user', content: message });

        // Show typing indicator
        showTyping();

        try {
            const response = await fetch(chAiConfig.ajaxUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: 'ch_ai_send_message',
                    nonce: chAiConfig.nonce,
                    message: message,
                    history: JSON.stringify(conversationHistory.slice(-10))
                })
            });

            const data = await response.json();

            hideTyping();

            if (data.success && data.data) {
                const botResponse = data.data.response || 'No pude procesar tu mensaje.';
                appendMessage(botResponse, 'bot');
                conversationHistory.push({ role: 'assistant', content: botResponse });
            } else {
                const errorMsg = data.data?.message || 'Lo siento, hubo un error.';
                appendMessage(errorMsg + ' Por favor intenta de nuevo.', 'bot');
            }
        } catch (error) {
            hideTyping();
            appendMessage('Lo siento, no pude conectarme al servidor. Por favor intenta más tarde.', 'bot');
            console.error('[CodeHub AI] Error:', error);
        }

        // Re-enable input
        inputField.disabled = false;
        sendBtn.disabled = false;
        inputField.focus();
    }

    // Quick message from buttons
    window.sendQuickMessage = function(message) {
        inputField.value = message;
        sendMessage();
    };

    // Append message to chat
    function appendMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'ch-ai-message ch-ai-' + sender;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'ch-ai-message-content';
        contentDiv.textContent = text;

        msgDiv.appendChild(contentDiv);
        messagesContainer.appendChild(msgDiv);

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Dispatch event for analytics
        widget.dispatchEvent(new CustomEvent('ch-ai-message', {
            detail: { sender, text }
        }));
    }

    // Show/hide typing indicator
    function showTyping() {
        if (typingIndicator) {
            typingIndicator.style.display = 'flex';
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    function hideTyping() {
        if (typingIndicator) {
            typingIndicator.style.display = 'none';
        }
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
