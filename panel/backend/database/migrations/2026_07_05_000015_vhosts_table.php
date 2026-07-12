<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('nginx_vhosts', function (Blueprint $table) {
            $table->id();
            $table->string('fqdn')->unique();
            $table->string('config_name');
            $table->string('document_root');
            $table->string('php_pool')->nullable();
            $table->boolean('ssl_enabled')->default(false);
            $table->boolean('force_https')->default(false);
            $table->boolean('hsts')->default(false);
            $table->json('redirects')->nullable();
            $table->json('proxy_rules')->nullable();
            $table->foreignId('subdomain_id')->nullable()->constrained('hosting_subdomains')->nullOnDelete();
            $table->string('status')->default('pending');
            $table->text('last_error')->nullable();
            $table->timestamps();
        });

        Schema::table('hosting_subdomains', function (Blueprint $table) {
            $table->string('php_pool')->nullable()->after('document_root');
            $table->boolean('ssl_enabled')->default(false)->after('php_pool');
            $table->boolean('force_https')->default(false)->after('ssl_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('hosting_subdomains', function (Blueprint $table) {
            $table->dropColumn(['php_pool', 'ssl_enabled', 'force_https']);
        });
        Schema::dropIfExists('nginx_vhosts');
    }
};
