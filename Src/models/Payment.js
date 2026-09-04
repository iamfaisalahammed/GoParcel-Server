const createPaymentModel = (data) => {
  return {
    ...data,
    createdAt: data.createdAt || new Date(),
  };
};

module.exports = createPaymentModel;