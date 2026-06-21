export const sendSuccess = (res: any, data: any, status = 200) => {
  return res.status(status).json({ success: true, data });
};

export const sendError = (res: any, error: any, status = 500) => {
  console.error("API Error:", error);
  const errorMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : "Internal Server Error";
  return res.status(status).json({ success: false, error: errorMessage });
};
