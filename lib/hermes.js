/**
 * @module rabbitmq
 */
'use strict';

var hermes = require('runnable-hermes').hermesSingletonFactory({
  name: 'service name',
  hostname: 'localhost',
  port: '5672',
  username: 'guest',
  password: 'guest',
  heartbeat: 10,
  persistent: true,
  prefetch: 10,
  queues: [ // queues to self-register with RabbitMQ on connect
    'task-queue-1',
    'task-queue-2'
  ],
  subscribedEvents: [ // read from fanout exchanges
    'task-queue-5',
    'task-queue-6'
  ]
}).connect();

module.exoprts = hermes;
