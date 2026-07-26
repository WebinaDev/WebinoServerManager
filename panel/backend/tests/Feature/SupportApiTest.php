<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Support\Entities\SupportTicket;
use Tests\TestCase;

class SupportApiTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesPermissionsSeeder::class);
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    }

    public function test_filter_tickets_by_status_and_priority(): void
    {
        SupportTicket::query()->create([
            'subject' => 'Open high',
            'body' => 'a',
            'priority' => 'high',
            'status' => 'open',
            'user_id' => $this->admin->id,
        ]);
        SupportTicket::query()->create([
            'subject' => 'Closed low',
            'body' => 'b',
            'priority' => 'low',
            'status' => 'closed',
            'user_id' => $this->admin->id,
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/support/tickets?status=open&priority=high')
            ->assertOk()
            ->assertJsonCount(1, 'tickets')
            ->assertJsonPath('tickets.0.subject', 'Open high');
    }

    public function test_reopen_closed_ticket(): void
    {
        $ticket = SupportTicket::query()->create([
            'subject' => 'Done',
            'body' => 'body',
            'priority' => 'normal',
            'status' => 'closed',
            'user_id' => $this->admin->id,
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/support/tickets/'.$ticket->id.'/reopen')
            ->assertOk()
            ->assertJsonPath('ticket.status', 'open');

        $this->assertSame('open', $ticket->fresh()->status);
    }
}
