import cms from '../cms/contact.json' with { type: 'json' };

export const GOOGLE_MAPS_URL = cms.googleMapsUrl;

export const contactInfo = {
  telefone: cms.telefone,
  whatsapp: cms.whatsapp,
  email: cms.email,
  endereco: cms.endereco,
  googleMapsUrl: cms.googleMapsUrl,
};
