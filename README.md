node-stomp-server
=================

## Overview
A simple STOMP server and a framework to build more advanced servers.

## Usage
###Invocation

    node app.js

### Wildcard destinations
**Asterisk**

    SUBSCRIBE /queue/a.b.*.d

...matches /queue/a.b.c.d or /queue/a.b.anything.d but not /queue/a.b.c.c.d

**Subtree**

    SUBSCRIBE /queue/a.b>

...matches /queue/a.b.c or /queue/a.b.anything.else.here but not /queue/a.b

    SUBSCRIBE /queue/a.b>.d

...matches /queue/a.b.c.d or /queue/a.b.anything.else.d but not /queue/a.b.d or /queue/a.b.d.c

## Concepts

A Broker maintains the mapping between Subscriptions and Destinations,
though a Destination is explicitly responsible for sending Frames to its
Subscriptions. In particular, the Broker is responsible for extending
existing Subscriptions to new Destinations and matching new Subscriptions
to existing Destinations.

A Server provides access to a Broker as a service by creating Connection
objects and maintaining the mappings between Connections and Subscriptions.

Middleware works on the Connection level by altering Frames going to or
coming from the Broker. The Subscription and Destination classes may be
subclassed to provide additional functionality, though specialized
Middleware would be required to utilize them. Default Middlware exists, for
example, to interpret SUBSCRIBE Frames and create Subscription and
Destination objects as necessary.

## TODO
* write API documentation
* write unit tests
* add server configuration support
* make destinations first-class API objects
* implement middleware for ActiveMQ-compatible destinations (queues, topics, tmp-queues, and tmp-topics)

## License
GNU Affero Public License v3

<!-- vim:tw=75:formatoptions-=l:formatoptions-=v:syntax=mkd
-->
