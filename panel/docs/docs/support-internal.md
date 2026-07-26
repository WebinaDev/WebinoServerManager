# Support (internal tickets)

The **Support** page in WebinoServerManager is for **internal panel tickets only**. It tracks issues and requests among panel operators and hosting staff.

There is **no integration** with external helpdesk products (Zendesk, Freshdesk, etc.). Do not expose this UI to end customers unless you build your own workflow on top of the internal API.

Tickets are stored in the panel MariaDB (`support_tickets`, `support_ticket_replies`) and are not synced off-host.
