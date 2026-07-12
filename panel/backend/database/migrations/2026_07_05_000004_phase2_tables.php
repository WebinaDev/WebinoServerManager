<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dns_zones', function (Blueprint $table) {
            $table->id();
            $table->string('domain')->unique();
            $table->string('status')->default('pending');
            $table->text('last_error')->nullable();
            $table->timestamps();
        });

        Schema::create('dns_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('zone_id')->constrained('dns_zones')->cascadeOnDelete();
            $table->string('type', 16);
            $table->string('name');
            $table->text('content');
            $table->unsignedInteger('ttl')->default(3600);
            $table->unsignedSmallInteger('priority')->nullable();
            $table->string('status')->default('pending');
            $table->text('last_error')->nullable();
            $table->timestamps();
        });

        Schema::create('ssl_certificates', function (Blueprint $table) {
            $table->id();
            $table->string('domain')->unique();
            $table->string('issuer')->nullable();
            $table->string('status')->default('pending');
            $table->timestamp('expires_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();
        });

        Schema::create('ftp_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('username')->unique();
            $table->string('home_dir');
            $table->string('domain')->nullable();
            $table->string('status')->default('pending');
            $table->text('last_error')->nullable();
            $table->timestamps();
        });

        Schema::create('php_pools', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('domain')->nullable();
            $table->string('php_version')->default('8.3');
            $table->json('settings')->nullable();
            $table->string('status')->default('pending');
            $table->text('last_error')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('php_pools');
        Schema::dropIfExists('ftp_accounts');
        Schema::dropIfExists('ssl_certificates');
        Schema::dropIfExists('dns_records');
        Schema::dropIfExists('dns_zones');
    }
};
