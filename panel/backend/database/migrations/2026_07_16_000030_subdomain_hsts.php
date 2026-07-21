<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('hosting_subdomains')) {
            return;
        }

        if (! Schema::hasColumn('hosting_subdomains', 'hsts')) {
            Schema::table('hosting_subdomains', function (Blueprint $table) {
                $table->boolean('hsts')->default(false)->after('force_https');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('hosting_subdomains') && Schema::hasColumn('hosting_subdomains', 'hsts')) {
            Schema::table('hosting_subdomains', function (Blueprint $table) {
                $table->dropColumn('hsts');
            });
        }
    }
};
