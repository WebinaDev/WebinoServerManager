<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('metric_samples', function (Blueprint $table) {
            if (! Schema::hasColumn('metric_samples', 'net_rx_bps')) {
                $table->float('net_rx_bps')->nullable()->after('load1');
            }
            if (! Schema::hasColumn('metric_samples', 'net_tx_bps')) {
                $table->float('net_tx_bps')->nullable()->after('net_rx_bps');
            }
            if (! Schema::hasColumn('metric_samples', 'disk_read_bps')) {
                $table->float('disk_read_bps')->nullable()->after('net_tx_bps');
            }
            if (! Schema::hasColumn('metric_samples', 'disk_write_bps')) {
                $table->float('disk_write_bps')->nullable()->after('disk_read_bps');
            }
        });
    }

    public function down(): void
    {
        Schema::table('metric_samples', function (Blueprint $table) {
            foreach (['net_rx_bps', 'net_tx_bps', 'disk_read_bps', 'disk_write_bps'] as $col) {
                if (Schema::hasColumn('metric_samples', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
