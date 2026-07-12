<?php

namespace Modules\Embed\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Embed\EmbedAccessPolicy;
use App\Services\Embed\EmbedTicketService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Databases\Entities\HostingDatabase;
use Modules\Email\Entities\MailAccount;
use RuntimeException;

class EmbedController extends Controller
{
    public function __construct(
        private readonly EmbedTicketService $tickets,
        private readonly EmbedAccessPolicy $embedAccess,
    ) {}

    public function phpMyAdminTicket(Request $request): JsonResponse
    {
        $request->user()?->can('embed.phpmyadmin') || abort(403);

        $data = $request->validate([
            'database_id' => ['nullable', 'integer', 'exists:hosting_databases,id'],
        ]);

        $claims = [
            'type' => 'phpmyadmin',
            'uid' => $request->user()->id,
        ];

        if (! empty($data['database_id'])) {
            $db = HostingDatabase::query()->findOrFail($data['database_id']);
            if (! $this->embedAccess->canAccessDatabase($request->user(), $db)) {
                abort(403);
            }
            $password = $db->db_password_encrypted ? decrypt($db->db_password_encrypted) : '';
            $claims['db'] = $db->name;
            $claims['user'] = $db->db_user ?? '';
            $claims['password'] = $password;
        }

        try {
            $ticket = $this->tickets->issue($claims);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }

        $embedPath = config('webino.phpmyadmin_url') !== ''
            ? rtrim((string) config('webino.phpmyadmin_url'), '/').'/signon.php'
            : '/embed/phpmyadmin/signon.php';

        return response()->json([
            'data' => [
                'ticket' => $ticket,
                'embed_path' => $embedPath,
                'expires_in' => $this->tickets->ttl(),
            ],
        ]);
    }

    public function phpMyAdminVerify(Request $request): JsonResponse
    {
        if (! $this->internalTokenValid($request)) {
            return response()->json(['ok' => false, 'error' => 'unauthorized'], 401);
        }

        $ticket = (string) $request->query('ticket', '');

        try {
            $payload = $this->tickets->verify($ticket);
        } catch (RuntimeException $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 403);
        }

        if (($payload['type'] ?? '') !== 'phpmyadmin') {
            return response()->json(['ok' => false, 'error' => 'invalid ticket type'], 403);
        }

        return response()->json([
            'ok' => true,
            'data' => [
                'host' => config('webino.mysql_host'),
                'user' => $payload['user'] ?? config('database.connections.mysql.username'),
                'password' => $payload['password'] ?? config('database.connections.mysql.password'),
                'db' => $payload['db'] ?? null,
            ],
        ]);
    }

    public function phpPgAdminTicket(Request $request): JsonResponse
    {
        $request->user()?->can('embed.phppgadmin') || abort(403);

        $data = $request->validate([
            'database_id' => ['nullable', 'integer', 'exists:hosting_databases,id'],
        ]);

        $claims = [
            'type' => 'phppgadmin',
            'uid' => $request->user()->id,
        ];

        if (! empty($data['database_id'])) {
            $db = HostingDatabase::query()->findOrFail($data['database_id']);
            if (! $this->embedAccess->canAccessDatabase($request->user(), $db)) {
                abort(403);
            }
            if (($db->engine ?? 'mysql') !== 'pgsql') {
                abort(422, 'database is not PostgreSQL');
            }
            $password = $db->db_password_encrypted ? decrypt($db->db_password_encrypted) : '';
            $claims['db'] = $db->name;
            $claims['user'] = $db->db_user ?? '';
            $claims['password'] = $password;
        }

        try {
            $ticket = $this->tickets->issue($claims);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }

        $embedPath = config('webino.phppgadmin_url') !== ''
            ? rtrim((string) config('webino.phppgadmin_url'), '/').'/signon.php'
            : '/embed/phppgadmin/signon.php';

        return response()->json([
            'data' => [
                'ticket' => $ticket,
                'embed_path' => $embedPath,
                'expires_in' => $this->tickets->ttl(),
            ],
        ]);
    }

    public function phpPgAdminVerify(Request $request): JsonResponse
    {
        if (! $this->internalTokenValid($request)) {
            return response()->json(['ok' => false, 'error' => 'unauthorized'], 401);
        }

        $ticket = (string) $request->query('ticket', '');

        try {
            $payload = $this->tickets->verify($ticket);
        } catch (RuntimeException $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 403);
        }

        if (($payload['type'] ?? '') !== 'phppgadmin') {
            return response()->json(['ok' => false, 'error' => 'invalid ticket type'], 403);
        }

        return response()->json([
            'ok' => true,
            'data' => [
                'host' => config('webino.pgsql_host'),
                'user' => $payload['user'] ?? '',
                'password' => $payload['password'] ?? '',
                'db' => $payload['db'] ?? null,
            ],
        ]);
    }

    public function webmailTicket(Request $request): JsonResponse
    {
        $request->user()?->can('embed.webmail') || abort(403);

        $data = $request->validate([
            'mail_account_id' => ['nullable', 'integer', 'exists:mail_accounts,id'],
        ]);

        $claims = [
            'type' => 'webmail',
            'uid' => $request->user()->id,
        ];

        if (! empty($data['mail_account_id'])) {
            $account = MailAccount::query()->findOrFail($data['mail_account_id']);
            if (! $this->embedAccess->canAccessMailAccount($request->user(), $account)) {
                abort(403);
            }
            $claims['email'] = $account->address;
            $claims['password'] = $account->password_encrypted ? decrypt($account->password_encrypted) : '';
        }

        try {
            $ticket = $this->tickets->issue($claims);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }

        $embedPath = config('webino.roundcube_url') !== ''
            ? rtrim((string) config('webino.roundcube_url'), '/').'/?_task=login'
            : '/embed/webmail/';

        return response()->json([
            'data' => [
                'ticket' => $ticket,
                'embed_path' => $embedPath,
                'expires_in' => $this->tickets->ttl(),
            ],
        ]);
    }

    public function webmailVerify(Request $request): JsonResponse
    {
        if (! $this->internalTokenValid($request)) {
            return response()->json(['ok' => false, 'error' => 'unauthorized'], 401);
        }

        $ticket = (string) $request->query('ticket', '');

        try {
            $payload = $this->tickets->verify($ticket);
        } catch (RuntimeException $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 403);
        }

        if (($payload['type'] ?? '') !== 'webmail') {
            return response()->json(['ok' => false, 'error' => 'invalid ticket type'], 403);
        }

        return response()->json([
            'ok' => true,
            'data' => [
                'email' => $payload['email'] ?? '',
                'password' => $payload['password'] ?? '',
            ],
        ]);
    }

    private function internalTokenValid(Request $request): bool
    {
        $expected = (string) config('webino.agent.token', '');
        $provided = (string) $request->header('X-Embed-Token', '');

        return $expected !== '' && hash_equals($expected, $provided);
    }
}
