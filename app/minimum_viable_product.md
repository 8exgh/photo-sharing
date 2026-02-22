# Photo Album System - MVP Gherkin Specifications (Filesystem-based)

## Feature: Album Management

```gherkin
Feature: Album Creation and Management
  As a site administrator
  I want to create and organize photo albums using the filesystem
  So that I can share collections of photos and videos with authorized users

  Scenario: Create a new album
    Given I am logged in as an administrator
    When I navigate to the album management page
    And I click "Create New Album"
    And I enter "Winter Visit to Rogers Pass" as the album name
    And I enter "2024" as the year
    And I enter "Glacier National Park, BC" as the location
    And I click "Save Album"
    Then a new folder "winter-visit-to-rogers-pass" should be created in "public/albums/2024/"
    And an "album.json" metadata file should be created in that folder
    And I should see "Album created successfully"
    And the album should appear in the albums list

  Scenario: Edit album information
    Given I am logged in as an administrator
    And an album folder "public/albums/2024/summer-vacation" exists
    When I click "Edit" for the "Summer Vacation" album
    And I update the description to "Family trip to the mountains"
    And I click "Save Changes"
    Then the "album.json" file should be updated with the new description
    And I should see "Album updated successfully"
```

## Feature: Media Upload

```gherkin
Feature: Photo and Video Upload
  As a site administrator
  I want to upload photos to album folders
  So that I can populate albums with media content

  Scenario: Upload a photo to an album
    Given I am logged in as an administrator
    And I have selected the "Winter Visit" album
    When I click "Add Photos"
    And I select "mountain-view.jpg" from my computer
    And I wait for the upload to complete
    Then the photo should be saved to "public/albums/2024/winter-visit/mountain-view.jpg"
    And a resized version should be created at "public/albums/2024/winter-visit/thumbnails/mountain-view.jpg"
    And the photo metadata should be added to "album.json"
    And I should see "Photo uploaded successfully"

  Scenario: Add video link to album
    Given I am logged in as an administrator
    And I have selected the "Winter Visit" album
    When I click "Add Video Link"
    And I enter "https://youtube.com/watch?v=example" as the video URL
    And I enter "Glacier Overview" as the video title
    And I click "Add Video"
    Then the video link should be added to the "album.json" file
    And I should see "Video link added successfully"
```

## Feature: Access Control

```gherkin
Feature: Secure Album Access
  As a site owner
  I want to restrict album access using session-based authentication
  So that content remains private and only accessible via special links

  Scenario: Generate secure access link
    Given I am logged in as an administrator
    And I have created an album "Private Family Photos"
    When I click "Generate Access Link"
    Then a passkey should be generated and stored in ".access-keys.json"
    And I should see a URL like "/albums?key=abc123xyz789"
    And the URL should be copyable

  Scenario: Access album with valid passkey
    Given I am not logged in
    And a valid passkey "abc123xyz789" exists in ".access-keys.json"
    When I visit "/albums?key=abc123xyz789"
    Then a session should be created
    And I should be redirected to "/albums"
    And I should see all available albums
    And I should see "Secure Access - Session Active" indicator

  Scenario: Deny access without valid passkey
    Given I am not logged in
    When I visit "/albums" without a passkey
    Then I should see "Access Denied"
    And I should not see any album content
```

## Feature: Navigation

```gherkin
Feature: Album Navigation
  As an authorized viewer
  I want to navigate through filesystem-based albums
  So that I can browse all available content during my session

  Scenario: Navigate albums by year
    Given I have an active session
    When I visit "/albums"
    Then I should see year folders from "public/albums/"
    When I click on "2024"
    Then I should see all album folders within "public/albums/2024/"

  Scenario: Navigate between photos in album
    Given I am viewing "/albums/2024/winter-visit" with a valid session
    And the album folder contains multiple image files
    When I click on a photo thumbnail
    Then I should see the photo in full view at "/albums/2024/winter-visit/photos/mountain-view"
    And I should see "Previous" and "Next" navigation buttons
    When I click "Next"
    Then I should see the next photo file in the album

  Scenario: Session persistence during navigation
    Given I have an active session from a valid passkey
    When I navigate to different album folders
    Then I should maintain access without re-entering the passkey
    And my session should remain active across all album routes
```

## Feature: Media Display

```gherkin
Feature: Photo and Video Display
  As a viewer
  I want to see photos from the filesystem with their information
  So that I can understand the context of each media item

  Scenario: View photo with metadata
    Given I am viewing an album with valid access
    When I click on a photo thumbnail
    Then the full image should load from "public/albums/[year]/[album]/[photo].jpg"
    And I should see metadata from "album.json"
    Including photo title, upload date, and description

  Scenario: Display video links
    Given I am viewing an album with valid access
    And the "album.json" contains video links
    When I view the album page
    Then I should see video placeholders with titles
    When I click on a video
    Then the video URL should open in an embedded player
```

## Feature: Filesystem Organization

```gherkin
Feature: Filesystem Structure
  As a system
  I want to maintain a clear filesystem structure
  So that albums and media are organized predictably

  Scenario: Initialize album structure
    Given the application is running
    When I check the filesystem
    Then I should see these directories:
      | Directory                    | Purpose                    |
      | public/albums/              | Root album directory       |
      | public/albums/[year]/       | Year-based organization    |
      | public/albums/[year]/[album]/ | Individual album folder  |
      | public/albums/[year]/[album]/thumbnails/ | Resized images |

  Scenario: Album metadata structure
    Given an album exists
    When I check the album folder
    Then I should find "album.json" containing:
      | Field        | Type     | Description              |
      | name         | string   | Album display name       |
      | location     | string   | Geographic location      |
      | description  | string   | Album description        |
      | created      | date     | Creation date           |
      | photos       | array    | Photo metadata array    |
      | videos       | array    | Video link array        |
```

## Non-Functional Requirements for Filesystem MVP

### Performance
- Use Next.js Image component for optimization
- Generate thumbnails on upload (max 300x300)
- Lazy load images in album view
- Cache filesystem reads where possible

### Security
- Store access keys in `.access-keys.json` (gitignored)
- Use Next.js middleware for session validation
- Prevent direct access to `/public/albums` via middleware
- Session cookies should be httpOnly and secure

### Filesystem Constraints
- Maximum 100MB per photo upload
- Support JPEG, PNG, WebP formats
- Album names sanitized to filesystem-safe slugs
- Automatic cleanup of orphaned files

## Implementation Notes

### Directory Structure Example
```
/public/albums/
├── 2024/
│   ├── winter-visit-to-rogers-pass/
│   │   ├── album.json
│   │   ├── mountain-view.jpg
│   │   ├── glacier-sunset.jpg
│   │   └── thumbnails/
│   │       ├── mountain-view.jpg
│   │       └── glacier-sunset.jpg
│   └── summer-vacation/
│       ├── album.json
│       └── ...
└── 2023/
    └── ...

/.access-keys.json (gitignored)
```

### Sample album.json
```json
{
  "name": "Winter Visit to Rogers Pass",
  "location": "Glacier National Park, BC",
  "description": "Beautiful winter landscapes",
  "created": "2024-01-15T10:30:00Z",
  "photos": [
    {
      "filename": "mountain-view.jpg",
      "title": "Mountain Vista",
      "uploadDate": "2024-01-15T10:35:00Z",
      "description": "Morning view of the mountains"
    }
  ],
  "videos": [
    {
      "url": "https://youtube.com/watch?v=example",
      "title": "Glacier Overview",
      "addedDate": "2024-01-15T11:00:00Z"
    }
  ]
}
```

## Technical Considerations for Filesystem Implementation
1. **File Upload**: Use Next.js API routes with formidable or multer
2. **Image Processing**: Sharp.js for resizing during upload
3. **Session Management**: iron-session or next-auth lite mode
4. **File Security**: Serve images through API routes with session check
5. **Metadata Storage**: JSON files per album (no database needed)