function success(res, data = null, message = 'OK', status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function error(res, message = 'Internal Server Error', status = 500, details = null) {
  const body = { success: false, message };
  if (details) body.details = details;
  return res.status(status).json(body);
}

module.exports = { success, error };
