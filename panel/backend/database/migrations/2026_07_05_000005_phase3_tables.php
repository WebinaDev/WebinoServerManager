<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mail_domains', function (Blueprint $table) {
            $table->id();
            $table->string('domain')->unique();
            $table->string('status')->default('pending');
            $table->text('last_error')->nullable();
            $table->timestamps();
        });

        Schema::create('mail_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mail_domain_id')->nullable()->constrained('mail_domains')->nullOnDelete();
            $table->string('address')->unique();
            $table->string('password_encrypted')->nullable();
            $table->unsignedInteger('quota_mb')->default(1024);
            $table->string('status')->default('pending');
            $table->text('last_error')->nullable();
            $table->timestamps();
        });

        Schema::create('mail_forwarders', function (Blueprint $table) {
            $table->id();
            $table->string('source')->unique();
            $table->string('destination');
            $table->string('status')->default('pending');
            $table->text('last_error')->nullable();
            $table->timestamps();
        });

        Schema::create('cron_jobs', function (Blueprint $table) {
            $table->id();
            $table->string('schedule');
            $table->text('command');
            $table->string('status')->default('pending');
            $table->text('last_error')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cron_jobs');
        Schema::dropIfExists('mail_forwarders');
        Schema::dropIfExists('mail_accounts');
        Schema::dropIfExists('mail_domains');
    }
};
