// utils/hubspot-api.js
// Wrapper complet pour l'API HubSpot CRM v3/v4

const BASE_URL = 'https://api.hubapi.com';

export class HubSpotAPI {
  constructor(accessToken) {
    this.token = accessToken;
  }

  async request(method, path, body = null) {
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${BASE_URL}${path}`, options);

    if (res.status === 401) throw new Error('TOKEN_EXPIRED');
    if (res.status === 429) throw new Error('RATE_LIMITED');
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.message || `API Error ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // CONTACTS

  async searchContactByLinkedinUrl(linkedinUrl) {
    const result = await this.request('POST', '/crm/v3/objects/contacts/search', {
      filterGroups: [{
        filters: [{
          propertyName: 'hs_linkedin_url',
          operator: 'EQ',
          value: linkedinUrl
        }]
      }],
      properties: ['firstname', 'lastname', 'jobtitle', 'company', 'hs_linkedin_url', 'email']
    });
    return result.total > 0 ? result.results[0] : null;
  }

  async searchContactByEmail(email) {
    const result = await this.request('POST', '/crm/v3/objects/contacts/search', {
      filterGroups: [{
        filters: [{
          propertyName: 'email',
          operator: 'EQ',
          value: email
        }]
      }],
      properties: ['firstname', 'lastname', 'jobtitle', 'company', 'hs_linkedin_url', 'email']
    });
    return result.total > 0 ? result.results[0] : null;
  }

  async createContact(properties) {
    return this.request('POST', '/crm/v3/objects/contacts', { properties });
  }

  async updateContact(contactId, properties) {
    return this.request('PATCH', `/crm/v3/objects/contacts/${contactId}`, { properties });
  }

  async findOrCreateContact(profileData) {
    const { firstName, lastName, jobTitle, companyName, linkedinUrl, email } = profileData;

    let existing = null;
    if (email) existing = await this.searchContactByEmail(email);
    if (!existing && linkedinUrl) existing = await this.searchContactByLinkedinUrl(linkedinUrl);

    const properties = {
      firstname: firstName,
      lastname: lastName,
      ...(jobTitle && { jobtitle: jobTitle }),
      ...(companyName && { company: companyName }),
      ...(linkedinUrl && { hs_linkedin_url: linkedinUrl }),
      ...(email && { email })
    };

    if (existing) {
      const updates = {};
      for (const [key, val] of Object.entries(properties)) {
        if (!existing.properties[key] && val) updates[key] = val;
      }
      if (Object.keys(updates).length > 0) await this.updateContact(existing.id, updates);
      return { id: existing.id, created: false, updated: Object.keys(updates).length > 0 };
    }

    const created = await this.createContact(properties);
    return { id: created.id, created: true, updated: false };
  }

  // COMPANIES

  async searchCompanyByName(name) {
    const result = await this.request('POST', '/crm/v3/objects/companies/search', {
      filterGroups: [{
        filters: [{
          propertyName: 'name',
          operator: 'EQ',
          value: name
        }]
      }],
      properties: ['name', 'domain', 'linkedin_company_page']
    });
    return result.total > 0 ? result.results[0] : null;
  }

  async searchCompanyByLinkedinUrl(linkedinCompanyUrl) {
    const result = await this.request('POST', '/crm/v3/objects/companies/search', {
      filterGroups: [{
        filters: [{
          propertyName: 'linkedin_company_page',
          operator: 'EQ',
          value: linkedinCompanyUrl
        }]
      }],
      properties: ['name', 'domain', 'linkedin_company_page']
    });
    return result.total > 0 ? result.results[0] : null;
  }

  async createCompany(properties) {
    return this.request('POST', '/crm/v3/objects/companies', { properties });
  }

  async updateCompany(companyId, properties) {
    return this.request('PATCH', `/crm/v3/objects/companies/${companyId}`, { properties });
  }

  async findOrCreateCompany({ companyName, companyLinkedinUrl }) {
    if (!companyName) return null;

    let existing = null;
    if (companyLinkedinUrl) existing = await this.searchCompanyByLinkedinUrl(companyLinkedinUrl);
    if (!existing) existing = await this.searchCompanyByName(companyName);

    const properties = {
      name: companyName,
      ...(companyLinkedinUrl && { linkedin_company_page: companyLinkedinUrl })
    };

    if (existing) {
      const updates = {};
      for (const [key, val] of Object.entries(properties)) {
        if (!existing.properties[key] && val) updates[key] = val;
      }
      if (Object.keys(updates).length > 0) await this.updateCompany(existing.id, updates);
      return { id: existing.id, created: false };
    }

    const created = await this.createCompany(properties);
    return { id: created.id, created: true };
  }

  // ASSOCIATIONS

  async associateContactToCompany(contactId, companyId) {
    return this.request(
      'PUT',
      `/crm/v4/objects/contacts/${contactId}/associations/companies/${companyId}`,
      [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 1 }]
    );
  }

  async getAccountInfo() {
    return this.request('GET', '/account-info/v3/details');
  }
}
