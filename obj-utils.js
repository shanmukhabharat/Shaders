/*
Author: Yotam Gingold <yotam (strudel) yotamgingold.com>
License: Public Domain. (I, Yotam Gingold, the author, dedicate any copyright to the Public Domain.)
http://creativecommons.org/publicdomain/zero/1.0/
*/
"use strict";

var OBJUtils = function() {
    var module = {};
    
    /*
    Given the text of an OBJ file, parses it and returns an object 'obj'
    with the properties:
        obj.vertex.positions are the 'v' lines as an array of floating point [ x, y, z ] values.
        obj.vertex.normals are the 'vn' lines as an array of floating point [ x, y, z ] values.
        obj.vertex.texCoords are the 'vt' lines as an array of floating point [ u, v ] values.
        
        obj.faceVertexIndices.positions, obj.faceVertexIndices.normals,
        and obj.faceVertexIndices.texCoords are the data from the 'f' lines
        as same-length arrays of three integer offsets [ index_0, index_1, index_2 ]
        into obj.vertex.positions, obj.vertex.normals, obj.vertex.texCoords.
    
    If properties are not present in the OBJ file, then the returned object will
    not contain that property.
    For example, if there are no 'vn' lines, then 'obj' will not have a 'vertices.normals'
    property.
    For example, if the 'f' lines do not specify texture coordinate indices,
    then 'obj' will not contain the '.faceVertexIndices.texCoords' property.
    
    NOTE: Optional parameter 'convert_to_triangles' will cause quad faces to be triangulated.  The default value is 'true'.
    
    Inspired by: http://stackoverflow.com/questions/5904230/parsing-obj-3d-graphics-file-with-javascript
    */
    function parse_OBJ_text( objText, convert_to_triangles )
    {
        // From: http://stackoverflow.com/questions/148901/is-there-a-better-way-to-do-optional-function-parameters-in-javascript
        if( typeof convert_to_triangles === "undefined" ) convert_to_triangles = true;
        
        /// Helper functions (strict mode requires us to put them at the top).
        // Parse a "v" line:
        function split_and_shift_float( objline )
        {
            var vals = objline.split(" ");
            vals.shift();
            return vals.map( function( v ) { return parseFloat(v); } );
        }
        
        // Parse an "f" line:
        function split_and_shift_face_element_generator( face_property_index )
        {
            return function( face ) {
                    var vals = face.split(" ");
                    vals.shift();
                    return vals.map( function( val ) { return parseInt( val.split("/")[ face_property_index ] )-1; } );
                };
        }
        
        // An assert-like function:
        function assert( x, msg ) { if( !x ) { console.log( msg ); alert( msg ); } }
        
        var obj = { 'vertex': {}, 'faceVertexIndices': {} };
        
        var matches = objText.match(/^v( -?(\d+(\.\d*)?|\.\d+))+$/gm);
        if( matches ) obj.vertex.positions = matches.map( split_and_shift_float );
        
        matches = objText.match(/^vn( -?(\d+(\.\d*)?|\.\d+))+$/gm);
        if( matches ) obj.vertex.normals = matches.map( split_and_shift_float );
        
        matches = objText.match(/^vt( -?(\d+(\.\d*)?|\.\d+))+$/gm);
        if( matches ) obj.vertex.texCoords = matches.map( split_and_shift_float );
        
        // Convert quad faces to triangles inspired by:
        // http://www.alecjacobson.com/weblog/?p=1548
        // NOTE: This isn't general enough to handle faces with more than 4 vertices.
        if( convert_to_triangles )
        {
            matches = objText.match(/^f( \d+(\/\d*){0,2}){3,4}$/gm);
            var num_facelines = matches.length;
            var facelines = matches.join("\n");
            facelines = facelines.replace(/^f ([0-9\/]+) ([0-9\/]+) ([0-9\/]+) ([0-9\/]+)$/gm, "f $1 $2 $3\nf $1 $3 $4" );
            matches = facelines.match(/^f( \d+(\/\d*){0,2}){3}$/gm);
            console.log( "OBJUtils.parse_OBJ_text(): converted " + ( matches.length - num_facelines ) + " quad faces (out of " + num_facelines + ") into triangles." );
        }
        else
        {
            matches = objText.match(/^f( \d+(\/\d*){0,2})+$/gm);
        }
        if( matches )
        {
            obj.faceVertexIndices.positions = matches.map( split_and_shift_face_element_generator( 0 ) );
            
            // This is the first face's first vertex; we will test which
            // properties it has and assume all face vertices have the same properties.
            var test_face_vertex_data = matches[0].split(" ")[1].split("/");
            
            // Do we have texture coordinates?
            if( test_face_vertex_data.length >= 2 && test_face_vertex_data[1].length > 0 )
            {
                obj.faceVertexIndices.texCoords = matches.map( split_and_shift_face_element_generator( 1 ) );
            }
            
            // Do we have normals?
            if( test_face_vertex_data.length >= 3 && test_face_vertex_data[2].length > 0 )
            {
                obj.faceVertexIndices.normals = matches.map( split_and_shift_face_element_generator( 2 ) );
            }
        }
        
        return obj;
    }
    module.parse_OBJ_text = parse_OBJ_text;
    
    // Given two three-element (xyz) arrays v1 and v2, returns the vector cross product: v1 cross v2.
    function cross( v1, v2 )
    {
        return [ v1[1] * v2[2] - v1[2] * v2[1], v1[2] * v2[0] - v1[0] * v2[2], v1[0] * v2[1] - v1[1] * v2[0] ];
    }
    // Given two three-element (xyz) arrays v1 and v2, returns v1 - v2;
    function sub( v1, v2 ) { return [ v1[0] - v2[0], v1[1] - v2[1], v1[2] - v2[2] ]; }
    // Given two three-element (xyz) arrays v1 and v2, returns v1 + v2;
    function add( v1, v2 ) { return [ v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2] ]; }
    // Given a scalar 's1' and a vector 'v1', returns 'v1' scaled by 's1'.
    function scale( s, v1 ) { return [ s * v1[0], s * v1[1], s * v1[2] ]; }
    // Given a three-element (xyz) array v1, returns v1 normalized.
    function normalized( v1 )
    {
        var ood = Math.sqrt( v1[0]*v1[0] + v1[1]*v1[1] + v1[2]*v1[2] );
        if( ood > 1e-5 ) ood = 1./ood;
        return [ ood*v1[0], ood*v1[1], ood*v1[2] ];
    }
    // Given two three-element arrays, returns the component-wise maximum.
    function cmax( v1, v2 )
    {
        return [ Math.max( v1[0], v2[0] ), Math.max( v1[1], v2[1] ), Math.max( v1[2], v2[2] ) ];
    }
    // Given two three-element arrays, returns the component-wise minimum.
    function cmin( v1, v2 )
    {
        return [ Math.min( v1[0], v2[0] ), Math.min( v1[1], v2[1] ), Math.min( v1[2], v2[2] ) ];
    }
    
    /*
    Given an object 'mesh' in the format returned by parsing an OBJ file with 'parse_OBJ_text()',
    modifies the '.vertex.positions' vertex property
    so that the mesh is centered at the origin and lies in a unit cube
    (each dimension will be in the range [-1..1]).
    
    NOTE: The passed 'mesh' object is modified in-place!
    */
    function normalize_parsed_OBJ( mesh )
    {
        /// 1 Initialize a min and max variable for x,y,z.
        /// 2 Iterate over each vertex and update the min and max.
        /// 3 Iterate again over each vertex, translating it by -(min+max)/2
        ///   and scaling it by one over the maximum coordinate of (max-min).
        
        /// 1
        // Use slice(0) to create a deep copy.
        var min = mesh.vertex.positions[0].slice(0);
        var max = mesh.vertex.positions[0].slice(0);
        
        /// 2
        for( var i = 0; i < mesh.vertex.positions.length; ++i )
        {
            min = cmin( min, mesh.vertex.positions[i] );
            max = cmax( max, mesh.vertex.positions[i] );
        }
        
        /// 3
        var s = 2. / Math.max.apply( null, sub( max, min ) );
        for( var i = 0; i < mesh.vertex.positions.length; ++i )
        {
            mesh.vertex.positions[i] = scale( s, add( mesh.vertex.positions[i], scale( -.5, add( min, max ) ) ) );
        }
    }
    module.normalize_parsed_OBJ = normalize_parsed_OBJ;
    
    /*
    Given an object 'mesh' in the format returned by parsing an OBJ file with 'parse_OBJ_text()',
    modifies the passed object to have a '.vertex.normals' vertex property
    and a '.faceVertexIndices.normals' face property with per-vertex normals calculated
    by averaging incident face normals.
    
    NOTE: The passed 'mesh' object is modified in-place!
    NOTE: If the passed 'mesh' object has '.vertex.normals'
          or '.faceVertexIndices.normals', they will be overwritten!
    */
    function insert_per_vertex_normals_to_parsed_OBJ( mesh )
    {
        /// 1 Initialize each vertex normal to zero.
        /// 2 Iterate over each face and calculate the cross product of its (first two) edges.
        /// 3 Contribute the face's normal to each of its vertices's normals.
        /// 4 Normalize each vertex normal.
        /// 5 Create faceNormalIndices.
        
        /// 1
        var vertex_normals = [];
        for( var i = 0; i < mesh.vertex.positions.length; ++i )
        {
            vertex_normals.push( [ 0., 0., 0. ] );
        }
        
        for( var i = 0; i < mesh.faceVertexIndices.positions.length; ++i )
        {
            var fvi = mesh.faceVertexIndices.positions[i];
            
            /// 2
            var n = cross(
                sub( mesh.vertex.positions[ fvi[1] ], mesh.vertex.positions[ fvi[0] ] ),
                sub( mesh.vertex.positions[ fvi[2] ], mesh.vertex.positions[ fvi[0] ] )
                );
            
            /// 3
            for( var vi = 0; vi < fvi.length; ++vi )
            {
                vertex_normals[ fvi[ vi ] ] = add( vertex_normals[ fvi[ vi ] ], n );
            }
        }
        
        /// 4
        for( var i = 0; i < vertex_normals.length; ++i )
        {
            vertex_normals[i] = normalized( vertex_normals[i] );
        }
        
        /// 5
        mesh.vertex.normals = vertex_normals;
        // Use map and slice(0) to create a deep copy.
        mesh.faceVertexIndices.normals = mesh.faceVertexIndices.positions.map( function( face ) { return face.slice(0); } );
    }
    module.insert_per_vertex_normals_to_parsed_OBJ = insert_per_vertex_normals_to_parsed_OBJ;
    
    /*
    Given an object 'mesh' in the format returned by parsing an OBJ file with 'parse_OBJ_text()',
    modifies the passed object to have '.vertex.tangents' and '.vertex.bitangents' vertex properties
    and '.faceVertexIndices.tangents' and '.faceVertexIndices.bitangents' face properties
    with per-vertex tangents and bitangents calculated by averaging incident face
    tangents and bitangents, respectively.
    
    NOTE: The passed 'mesh' object is modified in-place!
    NOTE: If the passed 'mesh' object has '.vertex.tangents', '.vertex.bitangents',
          '.faceVertexIndices.tangents', or '.faceVertexIndices.bitangents',
          they will be overwritten!
    */
    function insert_per_vertex_tangents_to_parsed_OBJ( mesh )
    {
        /// 1 Initialize each vertex tangent and bitangent to zero.
        /// 2 Iterate over each face and calculate the xyz-to-uv mapping for its edge vectors.
        /// 3 Use the mapping to recover xyz vectors for the u and v directions.
        /// 4 Contribute the face's tangent and bitangent to each of its vertices's tangents and bitangents.
        /// 5 Normalize each vertex tangent and bitangent.
        /// 6 Create faceVertexIndices.tangents and .bitangents.
        
        // Your code goes here.
		var vertex_tangents = [];
		var vertex_bitangents = [];
		var UV = mat3.create();
		var UV_inverse = mat3.create();
		var dv_matrix = mat3.create();
		var result = mat3.create();
		var tangent = [];
		var bitangent = [];
        for( var i = 0; i < mesh.vertex.positions.length; ++i )
        {
            vertex_tangents.push( [ 0., 0., 0. ] );
			vertex_bitangents.push( [ 0., 0., 0. ] );
        }
	
        for( var i = 0; i < mesh.faceVertexIndices.positions.length; ++i )
        {
            var fvi = mesh.faceVertexIndices.positions[i];
			var fti = mesh.faceVertexIndices.texCoords[i];
			//console.log("fvi" +fvi);
            // 2,3
			//change in positions
            var dPos1 =  sub( mesh.vertex.positions[ fvi[1] ], mesh.vertex.positions[ fvi[0] ] );
            var dPos2 =  sub( mesh.vertex.positions[ fvi[2] ], mesh.vertex.positions[ fvi[0] ] );
			//change in tex
            var dUV1 =  sub( mesh.vertex.texCoords[ fti[1] ], mesh.vertex.texCoords[ fti[0] ] );
            var dUV2 =  sub( mesh.vertex.texCoords[ fti[2] ], mesh.vertex.texCoords[ fti[0] ] );
			
			//make a 3*3
			UV[0] = dUV1[0];
			UV[1] = dUV1[1];
			UV[2] = 0.;
			
			UV[3] = dUV2[0];
			UV[4] = dUV2[1];
			UV[5] = 0.;
			
			UV[6] = 0.;
			UV[7] = 0.;
			UV[8] = 1.;
			
			//inverseof 3*3
			mat3.invert(UV_inverse, UV);
			
			//dpos 3*3
			dv_matrix[0] = dPos1[0]; dv_matrix[1] = dPos1[1]; dv_matrix[2] = dPos1[2];
			dv_matrix[3] = dPos2[0]; dv_matrix[4] = dPos2[1]; dv_matrix[5] = dPos2[2];
			dv_matrix[6] = 0.; dv_matrix[7] = 0.; dv_matrix[8] = 1.;
			
			mat3.multiply(result, dv_matrix, UV_inverse);
			
			tangent[0] = result[0]; tangent[1] = result[3]; tangent[2] = result[6];
			bitangent[0] = result[1]; bitangent[1] = result[4]; bitangent[2] = result[7];
			
			normalized(tangent); normalized(bitangent);
            
			// 4
            for( var vi = 0; vi < fvi.length; ++vi )
            {
                vertex_tangents[ fvi[ vi ] ] = add( vertex_tangents[ fvi[ vi ] ], tangent );
				vertex_bitangents[ fvi[ vi ] ] = add( vertex_bitangents[ fvi[ vi ] ], bitangent );
            }
        }
        // 5
        for( var i = 0; i < vertex_tangents.length; ++i )
        {
            vertex_tangents[i] = normalized( vertex_tangents[i] );
			//console.log("vertex tangents" + vertex_tangents[i]);
        }
		for( var i = 0; i < vertex_bitangents.length; ++i )
        {
            vertex_bitangents[i] = normalized( vertex_bitangents[i] );
			//console.log("vertex bitangents" + vertex_bitangents[i]);
		}
        // 6
        mesh.vertex.tangents = vertex_tangents;
		mesh.vertex.bitangents = vertex_bitangents;
        mesh.faceVertexIndices.tangents = mesh.faceVertexIndices.positions.map( function( face ) { return face.slice(0); } );
		mesh.faceVertexIndices.bitangents = mesh.faceVertexIndices.positions.map( function( face ) { return face.slice(0); } );

	}
    module.insert_per_vertex_tangents_to_parsed_OBJ = insert_per_vertex_tangents_to_parsed_OBJ;
    
    /*
    Given an object 'mesh' in the format returned by parsing an OBJ file with 'parse_OBJ_text()',
    modifies the passed object to have a '.vertex.normals' vertex property
    and a '.faceVertexIndices.normals' face property with per-face normals.
    
    NOTE: The passed 'mesh' object is modified in-place!
    NOTE: If the passed 'mesh' object has '.vertex.normals'
          or '.faceVertexIndices.normals', they will be overwritten!
    */
    function insert_per_face_normals_to_parsed_OBJ( mesh )
    {
        /// 1 Iterate over each face and calculate the cross product of its (first two) edges.
        /// 2 Append the normal to the list of face normals, and update faceNormalIndices to match.
        
        mesh.vertex.normals = [];
        mesh.faceVertexIndices.normals = [];
        
        for( var i = 0; i < mesh.faceVertexIndices.positions.length; ++i )
        {
            var fvi = mesh.faceVertexIndices.positions[i];
            
            /// 1
            var n = cross(
                sub( mesh.vertex.positions[ fvi[1] ], mesh.vertex.positions[ fvi[0] ] ),
                sub( mesh.vertex.positions[ fvi[2] ], mesh.vertex.positions[ fvi[0] ] )
                );
            
            /// 2
            mesh.vertex.normals.push( n );
            mesh.faceVertexIndices.normals.push( fvi.map( function( vi ) { return mesh.normals.length-1; } ) );
        }
    }
    module.insert_per_face_normals_to_parsed_OBJ = insert_per_face_normals_to_parsed_OBJ;
    
    /*
    Given an object 'mesh' in the format returned by parsing an OBJ file with 'parse_OBJ_text()',
    returns an object with the same vertex properties as 'mesh' but with no
    face properties where each vertex property is obtained by flattening
    the specified values from the corresponding face property.  For example:
        result.vertex.positions = [
            ...,
            mesh.vertex.positions[ mesh.faceVertexIndices.positions[i][0] ],
            mesh.vertex.positions[ mesh.faceVertexIndices.positions[i][1] ],
            mesh.vertex.positions[ mesh.faceVertexIndices.positions[i][2] ] ],
            ...
            ]
    
    This is useful because gl.drawElements() can't be used if the face properties
    are not identical; after flattening the parsed OBJ, gl.drawArrays() can be
    used.
    
    NOTE: The resulting vertex properties are still, e.g. '[ x, y, z ]', arrays
          and not completely flat; call flatten_array_of_arrays() for that.
    */
    function flatten_parsed_OBJ( mesh )
    {
        var flatmesh = { 'vertex': {}, 'faceVertexIndices': {} };
        
        for( var prop in mesh.faceVertexIndices )
        {
            flatmesh.vertex[ prop ] = [];
            
            for( var i = 0; i < mesh.faceVertexIndices[ prop ].length; ++i )
            for( var j = 0; j < mesh.faceVertexIndices[ prop ][i].length; ++j )
            {
                // Call slice(0) to duplicate the data rather than referencing
                // the same data as 'mesh'.
                flatmesh.vertex[ prop ].push( mesh.vertex[ prop ][ mesh.faceVertexIndices[ prop ][i][j] ].slice(0) );
            }
        }
        
        return flatmesh;
    }
    module.flatten_parsed_OBJ = flatten_parsed_OBJ;
    
    /*
    Given a WebGL context 'gl' and
    an object 'mesh' in the format returned by parsing an OBJ file with 'parse_OBJ_text()',
    creates a WebGL buffer for each property of 'mesh' and returns an object with
    the same property names as 'mesh', where each property's value is the WebGL
    buffer object.
    
    Optional parameter 'which', if present, is a dictionary with
    up to two entries, 'vertex' and 'faceVertexIndices', where the value
    of each entry is an array of properties of 'mesh' to create buffers for.
    
    NOTE: Buffers in the returned 'buffers' object can be deleted by:
        for( var key in buffers.vertex ) gl.deleteBuffer( buffers.vertex[key] );
        for( var key in buffers.faceVertexIndices ) gl.deleteBuffer( buffers.faceVertexIndices[key] );
    */
    function create_gl_buffers_from_parsed_OBJ( gl, mesh, which )
    {
        if( typeof which === "undefined" )
        {
            which = { 'vertex': [], 'faceVertexIndices': [] };
            for( var prop in mesh.vertex ) which.vertex.push( prop );
            for( var prop in mesh.faceVertexIndices ) which.faceVertexIndices.push( prop );
        }
        
        var buffers = { 'vertex': {}, 'faceVertexIndices': {} };
        
        if( 'vertex' in which )
        for( var i = 0; i < which.vertex.length; ++i )
        {
            var prop = which.vertex[i];
            buffers.vertex[ prop ] = gl.createBuffer();
            gl.bindBuffer( gl.ARRAY_BUFFER, buffers.vertex[prop] );
            gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( flatten_array_of_arrays( mesh.vertex[prop] ) ), gl.STATIC_DRAW );
        }
        
        if( 'faceVertexIndices' in which )
        for( var i = 0; i < which.faceVertexIndices.length; ++i )
        {
            var prop = which.faceVertexIndices[i];
            buffers.faceVertexIndices[ prop ] = gl.createBuffer();
            gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, buffers.faceVertexIndices[prop] );
            gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Uint16Array( flatten_array_of_arrays( mesh.faceVertexIndices[prop] ) ), gl.STATIC_DRAW );
        }
        
        return buffers;
    }
    module.create_gl_buffers_from_parsed_OBJ = create_gl_buffers_from_parsed_OBJ;
    
    /*
    Given a WebGL context 'gl',
    an object 'mesh' in the format returned by parsing an OBJ file with 'parse_OBJ_text()',
    an object 'buffers' containing WebGL buffer objects for each property in 'mesh',
    a WebGL shader program object 'shaderProgram', and
    a dictionary 'attributeMap' mapping names of attributes in the vertex shader
    to '.vertex' property names in 'mesh' and 'buffers',
    calls gl.VertexAttribPointer() and gl.enableVertexAttribArray() appropriately
    and returns a map from names of attributes in the vertex shader to the
    corresponding gl.getAttribLocation().
    
    NOTE: Attribute locations in the returned object must be disabled before
          switching to a different shader ( http://antongerdelan.net/webgl/ ):
        for( var attrib in attributeLocations ) gl.disableVertexAttribArray( attributeLocations[ attrib ] );
    */
    function attach_parsed_OBJ_gl_buffers_to_shader_vertex_attributes( gl, mesh, buffers, shaderProgram, attributeMap )
    {
        var attributeLocations = {};
        
        for( var attrib in attributeMap )
        {
            var prop = attributeMap[ attrib ];
            gl.bindBuffer( gl.ARRAY_BUFFER, buffers.vertex[ prop ] );
            
            var loc = gl.getAttribLocation( shaderProgram, attrib );
            gl.vertexAttribPointer( loc, mesh.vertex[ prop ][0].length, gl.FLOAT, false, 0, 0 );
            gl.enableVertexAttribArray( loc );
            
            attributeLocations[ attrib ] = loc;
        }
        
        return attributeLocations;
    }
    module.attach_parsed_OBJ_gl_buffers_to_shader_vertex_attributes = attach_parsed_OBJ_gl_buffers_to_shader_vertex_attributes;
    
    /*
    Given an array of arrays 'array_of_arrays',
    returns a single array containing the inner arrays back-to-back.
    For example, [[ 1,2,3 ], [ 4,5,6 ]] becomes [ 1,2,3,4,5,6 ].
    */
    function flatten_array_of_arrays( array_of_arrays )
    {
        // Every function has a .apply attribute that is itself
        // a method taking a 'this' parameter and an array whose
        // elements are used as the arguments.
        return [].concat.apply( [], array_of_arrays );
    }
    
    return module;
    }();
