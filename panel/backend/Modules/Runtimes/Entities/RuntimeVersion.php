<?php

namespace Modules\Runtimes\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RuntimeVersion extends Model
{
    protected $table = 'runtimes_versions';

    protected $fillable = [
        'slug',
        'runtime',
        'name',
        'install_method',
        'agent_script_id',
        'version_label',
        'status',
        'last_error',
    ];

    /** @return HasMany<RuntimeProject, $this> */
    public function projects(): HasMany
    {
        return $this->hasMany(RuntimeProject::class, 'runtime_version_id');
    }
}
