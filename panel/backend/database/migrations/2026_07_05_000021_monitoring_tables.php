<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_channels', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('type');
            $table->json('config');
            $table->boolean('enabled')->default(true);
            $table->timestamps();
        });

        Schema::create('uptime_checks', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('target');
            $table->string('type')->default('http');
            $table->unsignedInteger('interval_minutes')->default(5);
            $table->boolean('enabled')->default(true);
            $table->string('last_status')->nullable();
            $table->timestamp('last_checked_at')->nullable();
            $table->unsignedInteger('last_latency_ms')->nullable();
            $table->timestamps();
        });

        Schema::create('uptime_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('check_id')->constrained('uptime_checks')->cascadeOnDelete();
            $table->string('status');
            $table->unsignedInteger('latency_ms')->nullable();
            $table->timestamp('checked_at')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('uptime_results');
        Schema::dropIfExists('uptime_checks');
        Schema::dropIfExists('notification_channels');
    }
};
