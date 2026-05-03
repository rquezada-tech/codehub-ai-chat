export interface CustomerPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  type: 'Lead' | 'Customer';
  company?: string;
  notes?: string;
}

export interface ERPNextConfig {
  baseUrl: string;
  cookies?: string;
  apiKey?: string;
  apiSecret?: string;
}

// Create session-based ERPNext client (for development)
export async function createERPNextSession(config: ERPNextConfig) {
  const { baseUrl, cookies } = config;

  return {
    async request(method: string, endpoint: string, body?: object) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (cookies) {
        headers['Cookie'] = cookies;
      }

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const setCookie = response.headers.get('set-cookie');

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ERPNext error ${response.status}: ${error}`);
      }

      const data = await response.json();
      return { data, cookies: setCookie };
    },

    async createLead(payload: CustomerPayload) {
      const { data } = await this.request('POST', '/api/resource/Lead', {
        lead_name: payload.company || `${payload.firstName} ${payload.lastName}`,
        first_name: payload.firstName,
        last_name: payload.lastName,
        email_id: payload.email,
        phone: payload.phone,
        notes: payload.notes || '',
        source: 'Chat Widget',
      });
      return { id: data.data?.name, type: 'Lead' };
    },

    async createCustomer(payload: CustomerPayload) {
      const { data } = await this.request('POST', '/api/resource/Customer', {
        customer_name: payload.company || `${payload.firstName} ${payload.lastName}`,
        first_name: payload.firstName,
        last_name: payload.lastName,
        email_id: payload.email,
        phone: payload.phone,
        customer_type: payload.type === 'Lead' ? 'Company' : 'Individual',
      });
      return { id: data.data?.name, type: 'Customer' };
    },

    async createSalesOrder(payload: {
      customerId: string;
      items: Array<{ itemCode: string; qty: number; rate: number }>;
      notes?: string;
    }) {
      const { data } = await this.request('POST', '/api/resource/Sales Order', {
        customer: payload.customerId,
        items: payload.items.map(item => ({
          item_code: item.itemCode,
          qty: item.qty,
          rate: item.rate,
        })),
        notes: payload.notes || '',
      });
      return { id: data.data?.name };
    },

    async getItems(search?: string) {
      const { data } = await this.request('GET', `/api/resource/Item?fields=${encodeURIComponent('["name","item_name","item_code","standard_rate"]')}&limit=50`);
      return data.data || [];
    },
  };
}
