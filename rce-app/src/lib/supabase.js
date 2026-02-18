const SUPABASE_URL = "https://pjetnagkckravvquceam.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqZXRuYWdrY2tyYXZ2cXVjZWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzI1MzYsImV4cCI6MjA4NjY0ODUzNn0.iGreFq30EXrd4SirFulNUjBUGp284LiYIZweEw5fvo0";

export const supabase = {
    from: (table) => {
        return {
            select: (columns = "*", filter = "") => {
                const query = {
                    _columns: columns,
                    _filters: filter ? [filter] : [],
                    _eqFilters: [],

                    eq: function (column, value) {
                        this._eqFilters.push({ column, value });
                        return this;
                    },

                    order: function (column, options = {}) {
                        this._order = { column, ...options };
                        return this;
                    },

                    limit: function (count) {
                        this._limit = count;
                        return this;
                    },

                    then: async function (resolve, reject) {
                        try {
                            let url = `${SUPABASE_URL}/rest/v1/${table}?select=${this._columns}`;

                            // Add eq filters
                            this._eqFilters.forEach(({ column, value }) => {
                                url += `&${column}=eq.${value}`;
                            });

                            // Add other filters
                            if (this._filters.length > 0) {
                                url += `&${this._filters.join('&')}`;
                            }

                            // Add order
                            if (this._order) {
                                const dir = this._order.ascending === false ? 'desc' : 'asc';
                                url += `&order=${this._order.column}.${dir}`;
                            }

                            // Add limit
                            if (this._limit) {
                                url += `&limit=${this._limit}`;
                            }

                            const response = await fetch(url, {
                                headers: {
                                    "apikey": SUPABASE_ANON_KEY,
                                    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
                                }
                            });
                            if (!response.ok) throw new Error(await response.text());
                            resolve({ data: await response.json(), error: null });
                        } catch (error) {
                            resolve({ data: null, error });
                        }
                    }
                };

                return query;
            },
            insert: (data) => {
                const query = {
                    _data: data,
                    _doSelect: false,
                    select: function () {
                        this._doSelect = true;
                        return this;
                    },
                    then: async function (resolve, reject) {
                        try {
                            const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
                                method: "POST",
                                headers: {
                                    "apikey": SUPABASE_ANON_KEY,
                                    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                                    "Content-Type": "application/json",
                                    "Prefer": this._doSelect ? "return=representation" : "return=minimal"
                                },
                                body: JSON.stringify(this._data)
                            });
                            if (!response.ok) throw new Error(await response.text());
                            const data = this._doSelect ? await response.json() : null;
                            resolve({ data, error: null });
                        } catch (error) {
                            resolve({ data: null, error });
                        }
                    }
                };
                return query;
            },
            update: (data) => {
                const query = {
                    _data: data,
                    _eqFilters: [],
                    eq: function (column, value) {
                        this._eqFilters.push({ column, value });
                        return this;
                    },
                    then: async function (resolve, reject) {
                        try {
                            let url = `${SUPABASE_URL}/rest/v1/${table}`;
                            if (this._eqFilters.length > 0) {
                                const filters = this._eqFilters.map(({ column, value }) => `${column}=eq.${value}`);
                                url += `?${filters.join('&')}`;
                            }
                            const response = await fetch(url, {
                                method: "PATCH",
                                headers: {
                                    "apikey": SUPABASE_ANON_KEY,
                                    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                                    "Content-Type": "application/json",
                                    "Prefer": "return=representation"
                                },
                                body: JSON.stringify(this._data)
                            });
                            if (!response.ok) throw new Error(await response.text());
                            resolve({ data: await response.json(), error: null });
                        } catch (error) {
                            resolve({ data: null, error });
                        }
                    }
                };
                return query;
            },
            delete: function () {
                const query = {
                    _eqFilters: [],
                    eq: function (column, value) {
                        this._eqFilters.push({ column, value });
                        return this;
                    },
                    then: async function (resolve, reject) {
                        try {
                            let url = `${SUPABASE_URL}/rest/v1/${table}`;
                            if (this._eqFilters.length > 0) {
                                const filters = this._eqFilters.map(({ column, value }) => `${column}=eq.${value}`);
                                url += `?${filters.join('&')}`;
                            }
                            const response = await fetch(url, {
                                method: "DELETE",
                                headers: {
                                    "apikey": SUPABASE_ANON_KEY,
                                    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
                                }
                            });
                            if (!response.ok) throw new Error(await response.text());
                            resolve({ data: response.status === 204 ? null : await response.json(), error: null });
                        } catch (error) {
                            resolve({ data: null, error });
                        }
                    }
                };
                return query;
            }
        };
    },
    storage: {
        from: (bucket) => {
            return {
                upload: async (path, file) => {
                    try {
                        const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
                            method: "POST",
                            headers: {
                                "apikey": SUPABASE_ANON_KEY,
                                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                                "Content-Type": file.type || "application/octet-stream"
                            },
                            body: file
                        });
                        if (!response.ok) throw new Error(await response.text());
                        return { data: await response.json(), error: null };
                    } catch (error) {
                        return { data: null, error };
                    }
                },
                getPublicUrl: (path) => {
                    return {
                        data: {
                            publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`
                        }
                    };
                }
            };
        }
    }
};
