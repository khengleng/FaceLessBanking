export async function getHealth(_request, reply) {
    reply.code(200);
    return {
        status: 'ok',
        service: 'api-gateway',
        timestamp: new Date().toISOString()
    };
}
