# Kafka addon notes

If Railway environment does not provide managed Kafka:
- use external managed Kafka for staging, or
- temporarily disable non-critical consumers until broker is provisioned.

Set `KAFKA_BROKERS` accordingly.
