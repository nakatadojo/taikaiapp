function errorHandler(err, req, res, _next) {
  console.error(err.stack);
  const status = err.statusCode || 500;
  // Flat { error: "message" } matches every individual controller — keeps
  // client-side error handling consistent across the whole API surface.
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

module.exports = { errorHandler };
