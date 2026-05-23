const controllers = {};

controllers.test = async (request, response) => {
    return response.status(200).json({
        message: 'Test api working fine',
    });
};

export { controllers };
