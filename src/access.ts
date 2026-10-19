/** Site access is optional: asked for only when the user wants descriptions. */
export const SITE_ORIGINS = ['http://*/*', 'https://*/*'];

export const hasSiteAccess = () => chrome.permissions.contains({ origins: SITE_ORIGINS });
