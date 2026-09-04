const { ObjectId } = require("mongodb");

const createUserModel = (data) => {
  return {
    ...data,
    role: data.role || "user",
    createdAt: data.createdAt || new Date(),
  };
};

module.exports = createUserModel;