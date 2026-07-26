<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('nginx_vhosts', function (Blueprint $table) {
            if (! Schema::hasColumn('nginx_vhosts', 'engine')) {
                $table->string('engine', 16)->default('nginx')->after('config_name');
            }
            if (! Schema::hasColumn('nginx_vhosts', 'http3')) {
                $table->boolean('http3')->default(false)->after('hsts');
            }
        });

        Schema::table('hosting_websites', function (Blueprint $table) {
            if (! Schema::hasColumn('hosting_websites', 'engine')) {
                $table->string('engine', 16)->default('nginx')->after('type');
            }
            if (! Schema::hasColumn('hosting_websites', 'http3')) {
                $table->boolean('http3')->default(false)->after('hsts');
            }
        });
    }

    public function down(): void
    {
        Schema::table('nginx_vhosts', function (Blueprint $table) {
            if (Schema::hasColumn('nginx_vhosts', 'http3')) {
                $table->dropColumn('http3');
            }
            if (Schema::hasColumn('nginx_vhosts', 'engine')) {
                $table->dropColumn('engine');
            }
        });
        Schema::table('hosting_websites', function (Blueprint $table) {
            if (Schema::hasColumn('hosting_websites', 'http3')) {
                $table->dropColumn('http3');
            }
            if (Schema::hasColumn('hosting_websites', 'engine')) {
                $table->dropColumn('engine');
            }
        });
    }
};
