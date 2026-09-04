const createParcelModel = (data) => {
  return {
    ...data,
    createdAt: data.createdAt || new Date(),
  };
};

module.exports = createParcelModel;