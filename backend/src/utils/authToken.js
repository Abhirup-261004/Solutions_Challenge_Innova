function parseLocalAuthToken(token) {
  if (!token || !token.startsWith('local-auth:')) {
    return null;
  }

  try {
    const encoded = token.slice('local-auth:'.length);
    const json = Buffer.from(encoded, 'base64').toString('utf8');
    const parsed = JSON.parse(json);

    if (!parsed?.uid || !parsed?.role) {
      return null;
    }

    return {
      uid: String(parsed.uid),
      email: parsed.email ? String(parsed.email) : '',
      role: String(parsed.role)
    };
  } catch (error) {
    console.error('Local auth token parse error:', error);
    return null;
  }
}

module.exports = {
  parseLocalAuthToken
};
