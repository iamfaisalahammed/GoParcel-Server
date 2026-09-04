const createRiderModel = (data) => {
  return {
    ...data,
    status: data.status || "pending",
    workStatus: data.workStatus || "unavailable",
    createdAt: data.createdAt || new Date(),
  };
};

module.exports = createRiderModel;