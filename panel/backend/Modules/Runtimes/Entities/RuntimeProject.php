<?php

namespace Modules\Runtimes\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RuntimeProject extends Model
{
    protected $table = 'runtimes_projects';

    protected $fillable = [
        'name',
        'runtime',
        'runtime_version_id',
        'work_dir',
        'entry_script',
        'npm_script',
        'port',
        'status',
        'pid',
        'last_error',
    ];

    protected $casts = [
        'port' => 'integer',
        'pid' => 'integer',
    ];

    /** @return BelongsTo<RuntimeVersion, $this> */
    public function version(): BelongsTo
    {
        return $this->belongsTo(RuntimeVersion::class, 'runtime_version_id');
    }
}
