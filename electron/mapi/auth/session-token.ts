let token: string | null = null;
export const getSessionToken = () => token;
export const setSessionToken = (value: string | null) => { token = value; };
