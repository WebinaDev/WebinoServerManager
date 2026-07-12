<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dns_zones', function (Blueprint $table) {
            $table->string('zone_kind')->default('native')->after('domain');
            $table->string('master_ns')->nullable()->after('zone_kind');
            $table->boolean('dnssec_enabled')->default(false)->after('master_ns');
            $table->string('template')->nullable()->after('dnssec_enabled');
        });

        Schema::create('dns_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('description')->nullable();
            $table->json('records');
            $table->timestamps();
        });

        \DB::table('dns_templates')->insertOrIgnore([
                'name' => 'web_hosting',
                'description' => 'Default web hosting (A, MX, SPF)',
                'records' => json_encode([
                    ['name' => '@', 'type' => 'A', 'ttl' => 3600, 'content' => '127.0.0.1'],
                    ['name' => '@', 'type' => 'MX', 'ttl' => 3600, 'priority' => 10, 'content' => 'mail.{domain}'],
                    ['name' => '@', 'type' => 'TXT', 'ttl' => 3600, 'content' => 'v=spf1 mx ~all'],
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('dns_templates');
        Schema::table('dns_zones', function (Blueprint $table) {
            $table->dropColumn(['zone_kind', 'master_ns', 'dnssec_enabled', 'template']);
        });
    }
};
