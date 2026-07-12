<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hosting_quota_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hosting_account_id')->constrained('hosting_accounts')->cascadeOnDelete();
            $table->string('resource', 32);
            $table->unsignedTinyInteger('threshold_percent')->default(80);
            $table->boolean('enabled')->default(true);
            $table->unsignedInteger('escalation_minutes')->default(60);
            $table->string('escalation_channel', 32)->default('email');
            $table->unsignedInteger('breach_count')->default(0);
            $table->timestamp('last_notified_at')->nullable();
            $table->timestamps();

            $table->unique(['hosting_account_id', 'resource']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hosting_quota_alerts');
    }
};
