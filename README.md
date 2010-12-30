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

    
## TODO
* write API documentation
* write unit tests
* add server configuration support
* make destinations first-class API objects

## License
GNU Affero Public License v3
