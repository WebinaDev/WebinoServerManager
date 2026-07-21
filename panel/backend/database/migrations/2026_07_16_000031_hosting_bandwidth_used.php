<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hosting_accounts') && ! Schema::hasColumn('hosting_accounts', 'bandwidth_used_mb')) {
            Schema::table('hosting_accounts', function (Blueprint $table) {
                $table->unsignedBigInteger('bandwidth_used_mb')->default(0)->after('inodes_used');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('hosting_accounts') && Schema::hasColumn('hosting_accounts', 'bandwidth_used_mb')) {
            Schema::table('hosting_accounts', function (Blueprint $table) {
                $table->dropColumn('bandwidth_used_mb');
            });
        }
    }
};
