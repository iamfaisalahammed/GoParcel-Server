// Src/middlewares/verifyFBToken.js

const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({
      message: "unauthorized access",
    });
  }

  next();
};

module.exports = verifyFBToken;