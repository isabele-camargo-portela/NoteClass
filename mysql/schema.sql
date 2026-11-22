create database if not exists noteclass character set utf8mb4 collate utf8mb4_unicode_ci;

use noteclass;

create table folders (
    id int auto_increment primary key,
    parent_id int null,
    name varchar(120) not null,
    created_at timestamp not null default current_timestamp,
    index idx_folders_parent (parent_id),
    constraint fk_folders_parent foreign key (parent_id) references folders(id) on delete cascade
) engine = innodb;

create table notes (
    id int auto_increment primary key,
    folder_id int null,
    title varchar(200) not null default 'sem título',
    content longtext not null,
    note_date date not null,
    created_at timestamp not null default current_timestamp,
    updated_at timestamp not null default current_timestamp on update current_timestamp,
    index idx_notes_folder (folder_id),
    index idx_notes_date (note_date),
    constraint fk_notes_folder foreign key (folder_id) references folders(id) on delete cascade
) engine = innodb;

create table if not exists tags (
    id int auto_increment primary key,
    name varchar(50) not null,
    unique key uq_tags_name (name)
) engine = innodb;

create table if not exists note_tags (
    note_id int not null,
    tag_id int not null,
    primary key (note_id, tag_id),
    index idx_note_tags_tag (tag_id),
    constraint fk_nt_note foreign key (note_id) references notes(id) on delete cascade,
    constraint fk_nt_tag foreign key (tag_id) references tags(id) on delete cascade
) engine = innodb;