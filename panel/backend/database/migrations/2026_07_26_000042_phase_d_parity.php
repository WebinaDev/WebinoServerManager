<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Runtimes\Providers\RuntimesServiceProvider;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('metric_alerts', function (Blueprint $table) {
            if (! Schema::hasColumn('metric_alerts', 'severity')) {
                $table->string('severity', 16)->default('soft')->after('threshold');
            }
        });

        if (class_exists(RuntimesServiceProvider::class)) {
            RuntimesServiceProvider::seedCatalog();
        }
    }

    public function down(): void
    {
        Schema::table('metric_alerts', function (Blueprint $table) {
            if (Schema::hasColumn('metric_alerts', 'severity')) {
                $table->dropColumn('severity');
            }
        });
    }
};
