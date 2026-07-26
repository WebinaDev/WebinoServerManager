<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hosting_websites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hosting_account_id')->nullable()->constrained('hosting_accounts')->nullOnDelete();
            $table->string('fqdn', 253)->unique();
            $table->json('aliases')->nullable();
            $table->string('type', 16)->default('php'); // php|static|proxy
            $table->string('document_root', 255);
            $table->string('php_pool', 64)->nullable();
            $table->string('php_version', 8)->nullable();
            $table->boolean('ssl_enabled')->default(false);
            $table->boolean('force_https')->default(false);
            $table->boolean('hsts')->default(false);
            $table->boolean('hotlink_protect')->default(false);
            $table->string('rewrite_template', 32)->default('none');
            $table->text('rewrite_custom')->nullable();
            $table->json('deny_paths')->nullable();
            $table->unsignedInteger('traffic_limit_mb')->nullable();
            $table->string('proxy_pass', 512)->nullable();
            $table->foreignId('vhost_id')->nullable()->constrained('nginx_vhosts')->nullOnDelete();
            $table->foreignId('ftp_account_id')->nullable()->constrained('ftp_accounts')->nullOnDelete();
            $table->foreignId('database_id')->nullable()->constrained('hosting_databases')->nullOnDelete();
            $table->string('status', 32)->default('pending');
            $table->text('last_error')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hosting_websites');
    }
};
