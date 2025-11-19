// Family/Group Management System
class FamilyManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.currentGroup = null;
        this.userGroups = [];
        this.init();
    }

    async init() {
        await this.loadUserGroups();
        this.setupUI();
    }

    async loadUserGroups() {
        try {
            const { data, error } = await this.supabase.rpc('get_user_groups');
            if (error) throw error;
            
            this.userGroups = data || [];
            console.log('User groups loaded:', this.userGroups);
            
            // Set current group to first one or personal
            if (this.userGroups.length > 0) {
                this.currentGroup = this.userGroups[0];
            }
            
            this.updateGroupSelector();
        } catch (error) {
            console.error('Failed to load user groups:', error);
        }
    }

    setupUI() {
        this.createGroupManagementUI();
        // Remove header group selector - only use Settings
        // this.createGroupSelector();
        this.setupSettingsIntegration();
    }

    createGroupSelector() {
        const header = document.querySelector('.header-content');
        if (!header) return;

        // Remove existing group selector
        const existing = header.querySelector('.group-selector');
        if (existing) existing.remove();

        const groupSelector = document.createElement('div');
        groupSelector.className = 'group-selector';
        groupSelector.innerHTML = `
            <div class="group-dropdown">
                <button class="current-group-btn" onclick="familyManager.toggleGroupDropdown()">
                    <span class="group-icon">👨‍👩‍👧‍👦</span>
                    <span class="group-name">${this.currentGroup?.group_name || 'Personal'}</span>
                    <span class="dropdown-arrow">▼</span>
                </button>
                <div class="group-dropdown-menu" id="groupDropdown" style="display: none;">
                    <div class="group-list"></div>
                    <div class="group-actions">
                        <button class="btn btn-sm" onclick="familyManager.showCreateGroup()">
                            ➕ Create Group
                        </button>
                        <button class="btn btn-sm" onclick="familyManager.showJoinGroup()">
                            🔗 Join Group
                        </button>
                        <button class="btn btn-sm" onclick="familyManager.showManageGroups()">
                            ⚙️ Részletes kezelés
                        </button>
                    </div>
                </div>
            </div>
        `;

        header.appendChild(groupSelector);
        this.updateGroupDropdown();
    }

    updateGroupSelector() {
        const groupName = document.querySelector('.group-name');
        if (groupName) {
            groupName.textContent = this.currentGroup?.group_name || 'Personal';
        }
        this.updateGroupDropdown();
        
        // Update Settings display when group changes
        this.updateSettingsDisplay();
    }

    updateGroupDropdown() {
        const groupList = document.querySelector('.group-list');
        if (!groupList) return;

        groupList.innerHTML = this.userGroups.map(group => `
            <div class="group-item ${this.currentGroup?.group_id === group.group_id ? 'active' : ''}" 
                 onclick="familyManager.selectGroup('${group.group_id}')">
                <div class="group-item-info">
                    <span class="group-item-name">${group.group_name}</span>
                    <span class="group-item-role">${group.is_owner ? 'Owner' : group.role}</span>
                    <span class="group-item-members">${group.member_count} members</span>
                </div>
            </div>
        `).join('');
    }

    toggleGroupDropdown() {
        const dropdown = document.getElementById('groupDropdown');
        if (dropdown) {
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        }
    }

    selectGroup(groupId) {
        this.currentGroup = this.userGroups.find(g => g.group_id === groupId);
        this.updateGroupSelector();
        this.toggleGroupDropdown();
        
        // Trigger data reload with new group context
        window.dispatchEvent(new CustomEvent('groupChanged', { 
            detail: { group: this.currentGroup } 
        }));
    }

    async createGroup(name, description) {
        try {
            const { data, error } = await this.supabase
                .from('groups')
                .insert({
                    name: name,
                    description: description
                })
                .select()
                .single();

            if (error) throw error;

            await this.loadUserGroups();
            this.selectGroup(data.id);
            
            return { success: true, group: data };
        } catch (error) {
            console.error('Failed to create group:', error);
            return { success: false, error: error.message };
        }
    }

    async inviteUser(groupId, email, role = 'member') {
        try {
            const permissions = {
                view: true,
                add: role !== 'viewer',
                edit: ['owner', 'admin'].includes(role),
                delete: role === 'owner'
            };

            const { data, error } = await this.supabase
                .from('group_invitations')
                .insert({
                    group_id: groupId,
                    email: email,
                    role: role,
                    permissions: permissions
                })
                .select()
                .single();

            if (error) throw error;

            // Send invitation email (would need email service integration)
            await this.sendInvitationEmail(email, data.invite_token);

            return { success: true, invitation: data };
        } catch (error) {
            console.error('Failed to invite user:', error);
            return { success: false, error: error.message };
        }
    }

    async sendInvitationEmail(email, token) {
        // For now, just show the invitation link
        const inviteUrl = `${window.location.origin}?invite=${token}`;
        
        // Show invitation link to copy
        alert(`Invitation created! Share this link with ${email}:\n\n${inviteUrl}`);
        
        // Copy to clipboard
        try {
            await navigator.clipboard.writeText(inviteUrl);
            console.log('Invitation link copied to clipboard');
        } catch (err) {
            console.log('Could not copy to clipboard:', err);
        }
    }

    async createFamilyMember(groupId, email, password, role = 'member') {
        try {
            // First, create the user account in Supabase Auth
            const { data: authData, error: authError } = await this.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    emailRedirectTo: window.location.origin
                }
            });

            if (authError) {
                if (authError.message.includes('User already registered')) {
                    throw new Error('Ez az email cím már regisztrált. Használjon másik email címet vagy hívja meg a meglévő felhasználót.');
                }
                throw authError;
            }

            const userId = authData.user?.id;
            if (!userId) {
                throw new Error('Nem sikerült létrehozni a felhasználó fiókot');
            }

            // Set permissions based on role
            const permissions = {
                view: true,
                add: role !== 'viewer',
                edit: ['owner', 'admin'].includes(role),
                delete: role === 'owner'
            };

            // Add user to the group
            const { error: memberError } = await this.supabase
                .from('group_members')
                .insert({
                    group_id: groupId,
                    user_id: userId,
                    role: role,
                    permissions: permissions
                });

            if (memberError) {
                console.error('Failed to add user to group:', memberError);
                // User was created but couldn't be added to group
                throw new Error('Felhasználó létrehozva, de nem sikerült hozzáadni a csoporthoz. Próbálja meg újra meghívni.');
            }

            return { 
                success: true, 
                user: { id: userId, email: email },
                message: 'Családtag sikeresen létrehozva és hozzáadva a csoporthoz!'
            };
            
        } catch (error) {
            console.error('Failed to create family member:', error);
            return { 
                success: false, 
                error: error.message || 'Hiba történt a családtag létrehozása során'
            };
        }
    }

    async acceptInvitation(token) {
        try {
            const { data, error } = await this.supabase.rpc('accept_group_invitation', {
                invitation_token: token
            });

            if (error) throw error;

            if (data.success) {
                await this.loadUserGroups();
                this.selectGroup(data.group_id);
                return { success: true };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Failed to accept invitation:', error);
            return { success: false, error: error.message };
        }
    }

    createGroupManagementUI() {
        // Add CSS for group management
        const style = document.createElement('style');
        style.textContent = `
            .group-selector {
                position: relative;
                margin-left: auto;
                margin-right: 1rem;
            }
            
            .current-group-btn {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.5rem 1rem;
                background: var(--card-bg, white);
                border: 1px solid var(--border-color, #e5e7eb);
                border-radius: 0.5rem;
                cursor: pointer;
                font-size: 0.875rem;
                transition: all 0.2s ease;
            }
            
            .current-group-btn:hover {
                background: var(--hover-bg, #f9fafb);
            }
            
            .group-dropdown-menu {
                position: absolute;
                top: 100%;
                right: 0;
                min-width: 280px;
                background: white;
                border: 1px solid var(--border-color, #e5e7eb);
                border-radius: 0.5rem;
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                z-index: 1000;
                overflow: hidden;
            }
            
            .group-item {
                padding: 0.75rem;
                border-bottom: 1px solid var(--border-color, #f3f4f6);
                cursor: pointer;
                transition: background 0.2s ease;
            }
            
            .group-item:hover {
                background: var(--hover-bg, #f9fafb);
            }
            
            .group-item.active {
                background: var(--primary-bg, #dbeafe);
            }
            
            .group-item-name {
                display: block;
                font-weight: 600;
                color: var(--text-primary, #111827);
            }
            
            .group-item-role {
                display: inline-block;
                font-size: 0.75rem;
                background: var(--badge-bg, #f3f4f6);
                color: var(--badge-text, #6b7280);
                padding: 0.125rem 0.375rem;
                border-radius: 0.25rem;
                margin-top: 0.25rem;
                margin-right: 0.5rem;
            }
            
            .group-item-members {
                font-size: 0.75rem;
                color: var(--text-secondary, #6b7280);
            }
            
            .group-actions {
                padding: 0.75rem;
                border-top: 1px solid var(--border-color, #f3f4f6);
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            
            .group-actions .btn {
                text-align: left;
                background: none;
                border: none;
                padding: 0.5rem;
                border-radius: 0.25rem;
                cursor: pointer;
                transition: background 0.2s ease;
            }
            
            .group-actions .btn:hover {
                background: var(--hover-bg, #f9fafb);
            }
            
            .modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
            }
            
            .modal-content {
                background: white;
                border-radius: 0.5rem;
                padding: 2rem;
                max-width: 400px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            }
            
            @media (max-width: 768px) {
                .group-dropdown-menu {
                    right: -1rem;
                    left: -1rem;
                    min-width: auto;
                }
                
                .current-group-btn {
                    padding: 0.375rem 0.75rem;
                    font-size: 0.8rem;
                }
                
                .group-name {
                    max-width: 120px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            }
        `;
        document.head.appendChild(style);
    }

    showCreateGroup() {
        this.toggleGroupDropdown();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Create New Group</h2>
                <form id="createGroupForm">
                    <div class="form-group">
                        <label>Group Name:</label>
                        <input type="text" id="groupName" required maxlength="100" 
                               placeholder="My Family, Team Alpha, etc.">
                    </div>
                    <div class="form-group">
                        <label>Description (optional):</label>
                        <textarea id="groupDescription" rows="3" maxlength="500"
                                  placeholder="Shared expenses for our family"></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Create Group</button>
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('createGroupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('groupName').value;
            const description = document.getElementById('groupDescription').value;
            
            const result = await this.createGroup(name, description);
            
            if (result.success) {
                modal.remove();
                alert('Group created successfully!');
            } else {
                alert('Failed to create group: ' + result.error);
            }
        });
    }

    showJoinGroup() {
        this.toggleGroupDropdown();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Join Group</h2>
                <p>Enter the invitation link or code you received:</p>
                <form id="joinGroupForm">
                    <div class="form-group">
                        <label>Invitation Link or Code:</label>
                        <input type="text" id="inviteCode" required 
                               placeholder="https://... or invitation code">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Join Group</button>
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('joinGroupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            let code = document.getElementById('inviteCode').value.trim();
            
            // Extract token from URL if full URL provided
            if (code.includes('invite=')) {
                code = code.split('invite=')[1].split('&')[0];
            }
            
            const result = await this.acceptInvitation(code);
            
            if (result.success) {
                modal.remove();
                alert('Successfully joined group!');
            } else {
                alert('Failed to join group: ' + result.error);
            }
        });
    }

    showManageGroups() {
        this.toggleGroupDropdown();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Manage Groups</h2>
                <div id="groupManagementContent">
                    ${this.userGroups.map(group => `
                        <div class="group-management-item">
                            <div class="group-info">
                                <h3>${group.group_name}</h3>
                                <p>${group.is_owner ? 'Owner' : group.role} • ${group.member_count} members</p>
                            </div>
                            <div class="group-actions">
                                ${group.is_owner ? `
                                    <button class="btn btn-sm" onclick="familyManager.showInviteUsers('${group.group_id}')">
                                        👤 Családtag hozzáadása
                                    </button>
                                ` : ''}
                                <button class="btn btn-sm" onclick="familyManager.showGroupMembers('${group.group_id}')">
                                    👥 View Members
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async showInviteUsers(groupId) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>Családtag hozzáadása</h3>
                    <button class="modal-close">×</button>
                </div>
                <div class="modal-body">
                    <form id="inviteUserForm">
                        <div class="form-group">
                            <label>Email cím:</label>
                            <input type="email" id="inviteEmail" required 
                                   placeholder="csaladtag@example.com">
                        </div>
                        <div class="form-group">
                            <label>Jelszó:</label>
                            <input type="password" id="invitePassword" required 
                                   placeholder="Minimum 6 karakter" minlength="6">
                        </div>
                        <div class="form-group">
                            <label>Jelszó megerősítése:</label>
                            <input type="password" id="invitePasswordConfirm" required 
                                   placeholder="Jelszó újra" minlength="6">
                        </div>
                        <div class="form-group">
                            <label>Szerepkör:</label>
                            <select id="inviteRole">
                                <option value="member">Családtag (hozzáadhat és megtekinthet)</option>
                                <option value="admin">Adminisztrátor (kezelhet mindent)</option>
                                <option value="viewer">Néző (csak megtekinthet)</option>
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="submit" class="btn btn-primary">Családtag létrehozása</button>
                            <button type="button" class="btn btn-secondary modal-close">Mégse</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal event listeners
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        document.getElementById('inviteUserForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('inviteEmail').value;
            const password = document.getElementById('invitePassword').value;
            const confirmPassword = document.getElementById('invitePasswordConfirm').value;
            const role = document.getElementById('inviteRole').value;
            
            // Validate passwords match
            if (password !== confirmPassword) {
                alert('A jelszavak nem egyeznek!');
                return;
            }
            
            if (password.length < 6) {
                alert('A jelszó legalább 6 karakter hosszú legyen!');
                return;
            }
            
            const result = await this.createFamilyMember(groupId, email, password, role);
            
            if (result.success) {
                alert(`Családtag sikeresen létrehozva!\nEmail: ${email}\nJelszó: ${password}\n\nA családtag most már bejelentkezhet ezekkel az adatokkal.`);
                modal.remove();
                await this.loadUserGroups(); // Refresh group data
            } else {
                alert('Hiba történt: ' + result.error);
            }
        });
    }

    getCurrentGroupId() {
        return this.currentGroup?.group_id || null;
    }

    isPersonalMode() {
        return !this.currentGroup || this.currentGroup.group_id === null;
    }
}

// Auto-initialize when supabase is available
window.addEventListener('load', () => {
    // Check for invitation in URL
    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('invite');
    
    if (inviteToken) {
        // Store invite token to process after login
        sessionStorage.setItem('pendingInvite', inviteToken);
    }
});

FamilyManager.prototype.setupSettingsIntegration = function() {
    // Update Settings panel with current group info
    this.updateSettingsDisplay();
    
    // Setup Settings panel event listeners
    const createGroupBtn = document.getElementById('createGroupBtn');
    const addFamilyMemberBtn = document.getElementById('addFamilyMemberBtn');
    const manageGroupsBtn = document.getElementById('manageGroupsBtn');
    const groupSwitcher = document.getElementById('groupSwitcher');
    
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', () => this.showCreateGroup());
    }
    
    if (addFamilyMemberBtn) {
        addFamilyMemberBtn.addEventListener('click', () => {
            const currentGroupId = this.currentGroup?.group_id;
            if (currentGroupId) {
                this.showInviteUsers(currentGroupId);
            } else {
                alert('Először hozzon létre egy csoportot, mielőtt családtagot adna hozzá.');
            }
        });
    }
    
    if (manageGroupsBtn) {
        manageGroupsBtn.addEventListener('click', () => this.showManageGroups());
    }
    
    if (groupSwitcher) {
        groupSwitcher.addEventListener('change', (e) => {
            const selectedGroupId = e.target.value;
            this.switchToGroup(selectedGroupId);
        });
    }
};

FamilyManager.prototype.updateSettingsDisplay = function() {
    const groupName = document.getElementById('currentGroupName');
    const groupDescription = document.getElementById('currentGroupDescription');
    const memberCount = document.getElementById('groupMemberCount');
    
    if (groupName) {
        groupName.textContent = this.currentGroup?.group_name || 'Personal';
    }
    
    if (groupDescription) {
        if (this.currentGroup) {
            groupDescription.textContent = 'Családi költségvetés csoport';
        } else {
            groupDescription.textContent = 'Személyes költségvetés';
        }
    }
    
    if (memberCount) {
        memberCount.textContent = this.currentGroup?.member_count || 1;
    }
    
    // Load and display current group members
    this.loadCurrentGroupMembers();
    
    // Update group switcher dropdown
    this.updateGroupSwitcher();
};

FamilyManager.prototype.loadCurrentGroupMembers = async function() {
    const membersList = document.getElementById('membersList');
    if (!membersList) return;
    
    if (!this.currentGroup?.group_id) {
        membersList.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">Személyes mód - nincsenek csoporttagok</p>';
        return;
    }
    
    try {
        const { data, error } = await this.supabase
            .from('group_members')
            .select(`
                id,
                role,
                joined_at,
                user_id,
                users:user_id (email)
            `)
            .eq('group_id', this.currentGroup.group_id);
            
        if (error) throw error;
        
        if (data && data.length > 0) {
            membersList.innerHTML = data.map(member => `
                <div class="member-item">
                    <div class="member-info">
                        <div class="member-name">${member.users?.email || 'Unknown'}</div>
                        <div class="member-role">${this.translateRole(member.role)}</div>
                    </div>
                    <div class="member-actions">
                        <small style="color: var(--text-secondary);">
                            ${new Date(member.joined_at).toLocaleDateString('hu-HU')}
                        </small>
                    </div>
                </div>
            `).join('');
        } else {
            membersList.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">Még nincsenek csoporttagok</p>';
        }
    } catch (error) {
        console.error('Failed to load group members:', error);
        membersList.innerHTML = '<p style="color: var(--danger-color); font-style: italic;">Hiba a csoporttagok betöltése során</p>';
    }
};

FamilyManager.prototype.translateRole = function(role) {
    const roleTranslations = {
        'owner': 'Tulajdonos',
        'admin': 'Adminisztrátor', 
        'member': 'Családtag',
        'viewer': 'Néző'
    };
    return roleTranslations[role] || role;
};

FamilyManager.prototype.updateGroupSwitcher = function() {
    const groupSwitcher = document.getElementById('groupSwitcher');
    if (!groupSwitcher) return;
    
    // Clear current options
    groupSwitcher.innerHTML = '<option value="">Személyes mód</option>';
    
    // Add user groups
    this.userGroups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.group_id;
        option.textContent = group.group_name;
        
        // Select current group
        if (this.currentGroup && this.currentGroup.group_id === group.group_id) {
            option.selected = true;
        }
        
        groupSwitcher.appendChild(option);
    });
};

FamilyManager.prototype.switchToGroup = function(groupId) {
    if (!groupId) {
        // Switch to personal mode
        this.currentGroup = null;
    } else {
        // Switch to selected group
        this.currentGroup = this.userGroups.find(g => g.group_id === groupId);
    }
    
    // Update displays
    this.updateSettingsDisplay();
    
    // Dispatch group change event for other components
    window.dispatchEvent(new CustomEvent('groupChanged', {
        detail: { group: this.currentGroup }
    }));
};

// Export for use
if (typeof window !== 'undefined') {
    window.FamilyManager = FamilyManager;
}